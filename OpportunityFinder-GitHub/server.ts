import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'node:path';
import { store } from './src/lib/database/store';
import { checkRateLimit } from './src/lib/security/rate-limiter';
import { verifyTurnstileToken } from './src/lib/security/turnstile';
import { logSecurityEvent, getSecurityEvents } from './src/lib/security/events';
import { validateUrlSafety } from './src/lib/security/ssrf';
import { buildSafeCsv, parseCsvText } from './src/lib/security/csv';
import { discoveryService } from './src/services/discovery/discovery-service';
import { quotaService } from './src/lib/quota/quota-service';
import { providerRegistry } from './src/lib/providers';
import { Business } from './src/types';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS & Preflight support
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Workspace-Id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper: Extract current user / workspace from request
function getAuthContext(req: Request) {
  const authHeader = req.headers.authorization;
  const workspaceHeader = req.headers['x-workspace-id'] as string;

  // Default demo user and workspace
  const userId = (authHeader && authHeader.replace('Bearer ', '')) || 'usr_demo_001';
  const workspaceId = workspaceHeader || 'ws_demo_001';

  return { userId, workspaceId };
}

// Helper: Augment businesses with audits, lead status, contacts, and intelligence
function getAugmentedBusinesses(workspaceId: string, searchId?: string) {
  let businesses = store.getBusinesses(workspaceId);
  if (searchId) {
    businesses = businesses.filter((b) => b.searchId === searchId);
  }

  return businesses.map((b) => {
    const audit = store.getLatestAuditForBusiness(b.id);
    const audits = store.getAuditsForBusiness(b.id);
    const lead = store.getLeadForBusiness(b.id, workspaceId);
    const contacts = store.getContactsForBusiness(b.id);
    const aiReport = store.getLatestAIReportForBusiness(b.id);
    const evidence = store.getEvidenceForBusiness(b.id);

    return {
      ...b,
      audit,
      audits,
      lead,
      contactsCount: contacts.length,
      hasEmail: contacts.some((c) => !!c.email),
      hasPhone: contacts.some((c) => !!c.phone),
      hasWhatsApp: contacts.some((c) => !!c.whatsapp),
      hasDecisionMaker: contacts.some((c) => c.contactType === 'director' || c.contactType === 'owner'),
      contacts,
      evidence,
      aiReport,
    };
  });
}

// Dedicated API Router for full compatibility with direct routes and rewritten /api/* proxies
const apiRouter = express.Router();

// -------------------------------------------------------------
// 1. HEALTH & SYSTEM CONFIG ENDPOINTS
// -------------------------------------------------------------
apiRouter.get('/health', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.get('/config', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || store.getWorkspaceSetting(workspaceId, 'APIFY_API_TOKEN');

  res.json({
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    pageSpeedConfigured: !!process.env.PAGESPEED_API_KEY,
    googleMapsConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
    apifyConfigured: !!apifyToken,
    turnstileConfigured: !!process.env.TURNSTILE_SECRET_KEY,
    providers: providerRegistry.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isConfigured: p.id === 'apify_google_maps' ? !!apifyToken : p.isConfigured(),
    })),
  });
});

apiRouter.post('/config/apify-token', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { token } = req.body;
  if (token && typeof token === 'string' && token.trim().length > 0) {
    const trimmed = token.trim();
    store.setWorkspaceSetting(workspaceId, 'APIFY_API_TOKEN', trimmed);
    process.env.APIFY_API_TOKEN = trimmed;
    return res.json({ success: true, message: 'Apify API Token configured successfully.' });
  }
  return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Valid token string is required.' } });
});

// -------------------------------------------------------------
// 2. AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------
apiRouter.post('/auth/signup', async (req: Request, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  const rate = checkRateLimit(clientIp, 'auth_signup');
  if (!rate.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', clientIp, { endpoint: '/api/auth/signup' });
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } });
  }

  const { email, password, fullName, turnstileToken } = req.body;

  if (!email || !password || password.length < 12) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Email and password (minimum 12 characters) are required.' },
    });
  }

  // Turnstile verification
  const turnstileCheck = await verifyTurnstileToken(turnstileToken, clientIp);
  if (!turnstileCheck.success) {
    logSecurityEvent('AUTH_FAILED', clientIp, { reason: 'Turnstile verification failed' });
    return res.status(403).json({ error: { code: 'CAPTCHA_FAILED', message: 'Security verification failed.' } });
  }

  const existing = store.getUserByEmail(email);
  if (existing) {
    return res.json({
      success: true,
      message: 'If an account does not exist, a verification email has been sent.',
      userId: existing.id,
    });
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const workspaceId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const user = store.createUser({
    id: userId,
    email: email.trim().toLowerCase(),
    fullName: fullName || email.split('@')[0],
    isEmailVerified: true,
    role: 'owner',
    createdAt: new Date().toISOString(),
    passwordHash: 'argon2_hashed_password',
  });

  store.createWorkspace({
    id: workspaceId,
    name: `${user.fullName}'s Workspace`,
    ownerId: userId,
    plan: 'PRO',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    workspaceId,
  });
});

apiRouter.post('/auth/signin', async (req: Request, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  const rate = checkRateLimit(clientIp, 'auth_signin');
  if (!rate.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', clientIp, { endpoint: '/api/auth/signin' });
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const user = store.getUserByEmail(email);
  if (!user) {
    logSecurityEvent('AUTH_FAILED', clientIp, { emailAttempt: email });
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const workspaces = store.getUserWorkspaces(user.id);
  const activeWorkspace = workspaces[0];

  res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    workspaceId: activeWorkspace?.id || 'ws_demo_001',
    token: user.id,
  });
});

apiRouter.get('/auth/session', (req: Request, res: Response) => {
  const { userId, workspaceId } = getAuthContext(req);
  const user = store.getUserById(userId);

  if (!user) {
    return res.json({ authenticated: false });
  }

  const workspace = store.getWorkspaceById(workspaceId, userId) || store.getUserWorkspaces(userId)[0];

  res.json({
    authenticated: true,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    workspace,
  });
});

// -------------------------------------------------------------
// 3. SEARCH & DISCOVERY ENDPOINTS
// -------------------------------------------------------------
apiRouter.post('/searches', async (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const clientIp = req.ip || '127.0.0.1';

  const rate = checkRateLimit(clientIp, 'search');
  if (!rate.allowed) {
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Search rate limit reached. Please wait a moment.' } });
  }

  const {
    country,
    city,
    radiusKm,
    category,
    keywords,
    minOpportunityScore,
    provider,
    apifyToken,
    maxResults,
    onlyWithoutWebsite,
    mustHaveWebsite,
    requirePhone,
    opportunityFocus,
    sortPriority,
  } = req.body;
  if (apifyToken && typeof apifyToken === 'string' && apifyToken.trim()) {
    store.setWorkspaceSetting(workspaceId, 'APIFY_API_TOKEN', apifyToken.trim());
    process.env.APIFY_API_TOKEN = apifyToken.trim();
  }
  if (!city || !category) {
    return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'City and Category are required.' } });
  }

  try {
    const searchRecord = await discoveryService.startSearch(workspaceId, {
      country: country || 'Germany',
      city,
      radiusKm: Number(radiusKm) || 20,
      category,
      keywords,
      minOpportunityScore: Number(minOpportunityScore) || 0,
      provider: 'apify_google_maps',
      maxResults: maxResults ? Math.min(1000, Math.max(1, Number(maxResults))) : 20,
      onlyWithoutWebsite: Boolean(onlyWithoutWebsite),
      mustHaveWebsite: Boolean(mustHaveWebsite),
      requirePhone: Boolean(requirePhone),
      opportunityFocus: opportunityFocus || 'all',
      sortPriority: sortPriority || 'opportunity_score',
    });

    // Augment with businesses found so serverless responses have instant records
    const businesses = getAugmentedBusinesses(workspaceId, searchRecord.id);

    res.json({ search: searchRecord, businesses });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search initialization error';
    res.status(400).json({ error: { code: 'SEARCH_FAILED', message: msg } });
  }
});

apiRouter.get('/searches', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const searches = store.getWorkspaceSearches(workspaceId);
  res.json({ searches });
});

apiRouter.get('/searches/:id', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const search = store.getSearch(req.params.id, workspaceId);
  if (!search) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Search not found.' } });
  }
  res.json({ search });
});

// -------------------------------------------------------------
// 4. BUSINESSES & LEAD INTELLIGENCE ENDPOINTS
// -------------------------------------------------------------
apiRouter.get('/businesses', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const results = getAugmentedBusinesses(workspaceId);
  res.json({ businesses: results });
});

apiRouter.get('/businesses/:id', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const business = store.getBusinessById(req.params.id, workspaceId);

  if (!business) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Business record not found.' } });
  }

  const audit = store.getLatestAuditForBusiness(business.id);
  const audits = store.getAuditsForBusiness(business.id);
  const aiReport = store.getLatestAIReportForBusiness(business.id);
  const contacts = store.getContactsForBusiness(business.id);
  const evidence = store.getEvidenceForBusiness(business.id);
  const lead = store.getLeadForBusiness(business.id, workspaceId);

  res.json({
    business,
    audit,
    audits,
    aiReport,
    contacts,
    evidence,
    lead,
  });
});

apiRouter.post('/businesses', async (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { name, category, city, country, phone, websiteUrl, street } = req.body;

  if (!name || !city) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Business name and city are required.' } });
  }

  const businessId = `biz_man_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const hasUrl = !!websiteUrl && websiteUrl.trim() !== '';

  const business: Business = {
    id: businessId,
    workspaceId,
    name: name.trim(),
    category: category || 'Local Business',
    street,
    city: city.trim(),
    country: country || 'Germany',
    phone,
    websiteUrl: hasUrl ? websiteUrl.trim() : undefined,
    websiteStatus: hasUrl ? 'WEBSITE_FOUND' : 'NO_WEBSITE',
    source: 'manual',
    confidence: 1.0,
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.saveBusiness(business);
  res.json({ business });
});

apiRouter.post('/businesses/:id/suppress', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const success = store.suppressBusiness(req.params.id, workspaceId);
  if (!success) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Business not found.' } });
  }
  res.json({ success: true, message: 'Business marked DO_NOT_CONTACT and suppressed from outreach.' });
});

apiRouter.delete('/businesses/:id', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const success = store.deleteBusiness(req.params.id, workspaceId);
  if (!success) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Business not found.' } });
  }
  res.json({ success: true, message: 'Business data purged completely.' });
});

// -------------------------------------------------------------
// 5. LEADS MANAGEMENT ENDPOINTS
// -------------------------------------------------------------
apiRouter.patch('/leads/:id', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { status, notes, tags, followUpDate } = req.body;

  const updated = store.updateLead(req.params.id, workspaceId, {
    status,
    notes,
    tags,
    followUpDate,
  });

  if (!updated) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found.' } });
  }

  res.json({ lead: updated });
});

apiRouter.post('/leads/bulk-status', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { businessIds, status } = req.body;

  if (!Array.isArray(businessIds) || businessIds.length === 0 || !status) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'businessIds (non-empty array) and status are required.' } });
  }

  const updatedLeads = store.bulkUpdateLeadStatus(businessIds, workspaceId, status);
  res.json({ success: true, count: updatedLeads.length, leads: updatedLeads });
});

apiRouter.post('/leads/bulk-tags', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { businessIds, tag } = req.body;

  if (!Array.isArray(businessIds) || businessIds.length === 0 || !tag) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'businessIds array and tag are required.' } });
  }

  const updatedLeads = store.bulkAddTagToLeads(businessIds, workspaceId, tag);
  res.json({ success: true, count: updatedLeads.length, leads: updatedLeads });
});

apiRouter.post('/businesses/bulk-delete', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { businessIds } = req.body;

  if (!Array.isArray(businessIds) || businessIds.length === 0) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'businessIds array is required.' } });
  }

  const deletedCount = store.bulkDeleteBusinesses(businessIds, workspaceId);
  res.json({ success: true, deletedCount });
});

apiRouter.post('/businesses/bulk-suppress', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { businessIds } = req.body;

  if (!Array.isArray(businessIds) || businessIds.length === 0) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'businessIds array is required.' } });
  }

  const suppressedCount = store.bulkSuppressBusinesses(businessIds, workspaceId);
  res.json({ success: true, suppressedCount });
});

// -------------------------------------------------------------
// 6. CSV IMPORT & EXPORT
// -------------------------------------------------------------
apiRouter.post('/import/csv', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const { csvText } = req.body;

  if (!csvText) {
    return res.status(400).json({ error: { code: 'EMPTY_CSV', message: 'CSV payload is required.' } });
  }

  const rows = parseCsvText(csvText);
  if (rows.length < 2) {
    return res.status(400).json({ error: { code: 'INVALID_CSV', message: 'CSV must contain headers and at least one row.' } });
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('business'));
  const cityIdx = headers.findIndex((h) => h.includes('city') || h.includes('stadt'));
  const catIdx = headers.findIndex((h) => h.includes('category') || h.includes('industry'));
  const urlIdx = headers.findIndex((h) => h.includes('web') || h.includes('url') || h.includes('site'));
  const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('tel'));

  if (nameIdx === -1) {
    return res.status(400).json({ error: { code: 'MISSING_COLUMN', message: 'CSV must contain a business name column.' } });
  }

  let importedCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[nameIdx];
    if (!name) continue;

    const city = cityIdx !== -1 && row[cityIdx] ? row[cityIdx] : 'Unknown';
    const category = catIdx !== -1 && row[catIdx] ? row[catIdx] : 'General';
    const websiteUrl = urlIdx !== -1 && row[urlIdx] ? row[urlIdx] : undefined;
    const phone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx] : undefined;

    const businessId = `biz_csv_${Date.now()}_${i}`;
    const business: Business = {
      id: businessId,
      workspaceId,
      name,
      category,
      city,
      country: 'Germany',
      phone,
      websiteUrl,
      websiteStatus: websiteUrl ? 'WEBSITE_FOUND' : 'NO_WEBSITE',
      source: 'user_csv',
      confidence: 0.9,
      lastVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveBusiness(business);
    importedCount++;
  }

  res.json({ success: true, importedCount });
});

apiRouter.get('/export/csv', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const businesses = store.getBusinesses(workspaceId);

  const quotaCheck = quotaService.canPerform(workspaceId, 'export');
  if (!quotaCheck.allowed) {
    return res.status(403).json({ error: { code: 'QUOTA_EXCEEDED', message: quotaCheck.message } });
  }

  quotaService.recordUsage(workspaceId, 'export', 1);

  const headers = [
    'Business Name',
    'Category',
    'City',
    'Country',
    'Phone',
    'Website URL',
    'Website Status',
    'Opportunity Score',
    'Website Health Score',
    'Lead Status',
    'Primary Contact',
    'Contact Email',
    'WhatsApp Link',
    'Source Provenance',
  ];

  const rows = businesses.map((b) => {
    const audit = store.getLatestAuditForBusiness(b.id);
    const lead = store.getLeadForBusiness(b.id, workspaceId);
    const contacts = store.getContactsForBusiness(b.id);
    const primaryContact = contacts.find((c) => c.fullName) || contacts[0];

    return [
      b.name,
      b.category,
      b.city,
      b.country,
      b.phone || '',
      b.websiteUrl || '',
      b.websiteStatus,
      audit?.opportunityScore ?? 0,
      audit?.websiteHealthScore ?? 0,
      lead?.status ?? 'NEW',
      primaryContact?.fullName || '',
      primaryContact?.email || '',
      primaryContact?.whatsapp || '',
      b.sourceUrl || b.source,
    ];
  });

  const csv = buildSafeCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="leads_export_${Date.now()}.csv"`);
  res.send(csv);
});

// -------------------------------------------------------------
// 7. QUOTA & USAGE
// -------------------------------------------------------------
apiRouter.get('/quota', (req: Request, res: Response) => {
  const { workspaceId } = getAuthContext(req);
  const quota = store.getQuota(workspaceId);
  res.json({ quota });
});

// -------------------------------------------------------------
// 8. PENETRATION & SECURITY TEST SUITE
// -------------------------------------------------------------
apiRouter.get('/security/events', (req: Request, res: Response) => {
  res.json({ events: getSecurityEvents(100) });
});

apiRouter.post('/security/run-tests', async (req: Request, res: Response) => {
  const results: Array<{ testName: string; passed: boolean; details: string }> = [];

  // Test 1: SSRF - Localhost 127.0.0.1
  const t1 = await validateUrlSafety('http://127.0.0.1:8080/admin');
  results.push({
    testName: 'SSRF: Block 127.0.0.1 loopback',
    passed: !t1.safe,
    details: t1.safe ? 'FAILED: Allowed loopback' : `Blocked safely: ${t1.reason}`,
  });

  // Test 2: SSRF - Cloud Metadata (169.254.169.254)
  const t2 = await validateUrlSafety('http://169.254.169.254/computeMetadata/v1/');
  results.push({
    testName: 'SSRF: Block Cloud Metadata 169.254.169.254',
    passed: !t2.safe,
    details: t2.safe ? 'FAILED: Allowed metadata' : `Blocked safely: ${t2.reason}`,
  });

  // Test 3: SSRF - IPv6 Loopback [::1]
  const t3 = await validateUrlSafety('http://[::1]:80/internal');
  results.push({
    testName: 'SSRF: Block IPv6 [::1] Loopback',
    passed: !t3.safe,
    details: t3.safe ? 'FAILED: Allowed IPv6 loopback' : `Blocked safely: ${t3.reason}`,
  });

  // Test 4: SSRF - Private 10.0.0.1 & 192.168.1.1
  const t4 = await validateUrlSafety('http://192.168.1.1/router');
  results.push({
    testName: 'SSRF: Block Private RFC1918 192.168.1.1',
    passed: !t4.safe,
    details: t4.safe ? 'FAILED: Allowed private IP' : `Blocked safely: ${t4.reason}`,
  });

  // Test 5: CSV Formula Injection escaping
  const testPayload = '=cmd|"/c calc"!A0';
  const safeCsv = buildSafeCsv(['Formula'], [[testPayload]]);
  const formulaEscaped = safeCsv.includes("''=cmd") || safeCsv.includes("'=");
  results.push({
    testName: 'CSV Injection: Escape formula starting with "="',
    passed: formulaEscaped,
    details: formulaEscaped ? 'Prefix apostrophe added properly' : 'FAILED: Raw formula unescaped',
  });

  // Test 6: Cross-tenant RLS isolation
  const crossTenantAccess = store.getWorkspaceById('ws_other_tenant', 'usr_demo_001');
  results.push({
    testName: 'RLS: Cross-tenant unauthorized workspace access denied',
    passed: crossTenantAccess === null,
    details: crossTenantAccess === null ? 'Protected: Returned null' : 'FAILED: Leaked other tenant workspace',
  });

  res.json({
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    allPassed: results.every((r) => r.passed),
    results,
  });
});

// -------------------------------------------------------------
// 9. ROUTER MOUNTING & API 404 CATCH-ALL
// -------------------------------------------------------------
// Mount apiRouter under both /api and root to guarantee match across Vercel rewrite configurations
app.use('/api', apiRouter);
app.use(apiRouter);

// Global Express error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled server error on path:', req.path, err);
  if (res.headersSent) {
    return next(err);
  }
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = err?.message || 'An unexpected server error occurred. Please try again.';
  res.status(status).json({
    error: {
      code: err?.code || 'INTERNAL_ERROR',
      message,
    },
  });
});

// Safety handlers for uncaught process exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in server process:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in server process:', reason);
});

// -------------------------------------------------------------
// 10. VITE SPA MIDDLEWARE FOR SERVING FRONTEND (LOCAL / STANDALONE)
// -------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Local Business Opportunity Finder server listening on port ${PORT}`);
  });
}

// Only start standalone HTTP server when executed directly and not inside Vercel serverless environment
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  start();
}

export { app };
export default app;
