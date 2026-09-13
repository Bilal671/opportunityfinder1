export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  fullName: string;
  isEmailVerified: boolean;
  role: UserRole;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  plan: 'FREE' | 'PRO' | 'AGENCY';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: UserRole;
  createdAt: string;
}

export type WebsiteStatus = 'WEBSITE_FOUND' | 'NO_WEBSITE' | 'WEBSITE_DOWN' | 'BLOCKED_BY_SITE' | 'UNKNOWN';

export type OpportunityCategory =
  | 'NO_WEBSITE'
  | 'WEBSITE_DOWN'
  | 'VERY_SLOW'
  | 'NOT_MOBILE'
  | 'OUTDATED_DESIGN'
  | 'POOR_SEO'
  | 'POOR_CONVERSION'
  | 'HIGH_COMMERCIAL_POTENTIAL'
  | 'HIGH_PRIORITY';

export type LeadStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'MEETING'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST'
  | 'DO_NOT_CONTACT';

export interface Business {
  id: string;
  workspaceId: string;
  searchId?: string;
  name: string;
  legalName?: string;
  category: string;
  subcategory?: string;
  description?: string;
  street?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  websiteUrl?: string;
  websiteStatus: WebsiteStatus;
  source: 'licensed' | 'open_data' | 'user_csv' | 'manual' | 'google_places_official';
  sourceId?: string;
  sourceUrl?: string;
  confidence: number;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
  isSuppressed?: boolean;
}

export interface Website {
  id: string;
  businessId: string;
  url: string;
  canonicalUrl?: string;
  domain: string;
  httpsEnabled: boolean;
  httpStatus?: number;
  redirectCount: number;
  cms?: string;
  cmsVersion?: string;
  hostingProvider?: string;
  robotsStatus: 'allowed' | 'disallowed' | 'unknown';
  sitemapExists: boolean;
  websiteStatus: WebsiteStatus;
  firstSeenAt: string;
  lastCheckedAt: string;
  technologies: string[];
}

export interface AuditMetrics {
  fcp?: number; // First Contentful Paint (ms)
  lcp?: number; // Largest Contentful Paint (ms)
  cls?: number; // Cumulative Layout Shift
  inp?: number; // Interaction to Next Paint (ms)
  tbt?: number; // Total Blocking Time (ms)
  speedIndex?: number;
  pageSizeBytes?: number;
  responseDurationMs?: number;
  viewportMeta: boolean;
  responsiveLayout: boolean;
  horizontalOverflow: boolean;
  textReadabilityScore: number;
  tapTargetsScore: number;
  responsiveImagesScore: number;
  navigationScore: number;
  metaDescriptionExists: boolean;
  h1Exists: boolean;
  sslValid: boolean;
}

export interface Audit {
  id: string;
  businessId: string;
  websiteId?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  failureReason?: string;
  performanceScore: number; // 0 - 100
  mobileScore: number; // 0 - 100
  seoScore: number; // 0 - 100
  accessibilityScore: number; // 0 - 100
  bestPracticesScore: number; // 0 - 100
  designScore: number; // 0 - 100
  uxScore: number; // 0 - 100
  conversionScore: number; // 0 - 100
  technologyScore: number; // 0 - 100
  websiteHealthScore: number; // Deterministic 0 - 100
  opportunityScore: number; // Deterministic 0 - 100
  metrics: AuditMetrics;
  createdAt: string;
  completedAt?: string;
}

export type ContactType = 'business' | 'generic' | 'employee' | 'manager' | 'director' | 'owner' | 'unknown';

export interface Contact {
  id: string;
  businessId: string;
  fullName?: string;
  jobTitle?: string;
  email?: string;
  emailType?: 'generic' | 'personal' | 'department';
  phone?: string;
  whatsapp?: string;
  socialUrl?: string;
  contactType: ContactType;
  publiclyListed: boolean;
  verified: boolean;
  confidence: number;
  sourceUrl: string;
  sourceType: string;
  collectedAt: string;
  isSuppressed?: boolean;
}

export interface EvidenceRecord {
  id: string;
  businessId: string;
  fieldName: string;
  fieldValue: string;
  sourceUrl: string;
  sourceType: string;
  confidence: number;
  collectedAt: string;
  contentHash: string;
  snippet?: string;
}

export interface AIProblem {
  type: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
}

export interface AIReport {
  id: string;
  businessId: string;
  auditId: string;
  visualScore: number;
  uxScore: number;
  conversionScore: number;
  technologyScore: number;
  summary: string;
  executiveSummary: string;
  problems: AIProblem[];
  recommendedServices: string[];
  confidence: number;
  promptTokens?: number;
  responseTokens?: number;
  model: string;
  generatedAt: string;
}

export interface Lead {
  id: string;
  workspaceId: string;
  businessId: string;
  status: LeadStatus;
  notes: string;
  tags: string[];
  categories: OpportunityCategory[];
  followUpDate?: string;
  lastContactedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type DataSourceProvider =
  | 'apify_google_maps'
  | 'user_csv'
  | 'manual';

export interface SearchParams {
  country: string;
  city: string;
  radiusKm: number;
  category: string;
  keywords?: string;
  minOpportunityScore?: number;
  provider?: DataSourceProvider;
  apifyToken?: string;
  maxResults?: number;
  onlyWithoutWebsite?: boolean;
  mustHaveWebsite?: boolean;
  requirePhone?: boolean;
  opportunityFocus?: 'all' | 'no_website' | 'performance_mobile' | 'seo_security';
  sortPriority?: 'opportunity_score' | 'conversion_potential' | 'distance';
}

export type SearchStage =
  | 'DISCOVERY'
  | 'WEBSITE_CHECK'
  | 'CRAWLING'
  | 'PERFORMANCE'
  | 'MOBILE'
  | 'CONTACT_EXTRACTION'
  | 'AI_ANALYSIS'
  | 'SCORING'
  | 'COMPLETE';

export interface SearchRecord {
  id: string;
  workspaceId: string;
  params: SearchParams;
  stage: SearchStage;
  progressPercent: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalDiscovered: number;
  websitesFound: number;
  noWebsites: number;
  auditsCompleted: number;
  highOpportunities: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface SavedSearch {
  id: string;
  workspaceId: string;
  name: string;
  params: SearchParams;
  createdAt: string;
}

export interface UsageQuota {
  workspaceId: string;
  plan: 'FREE' | 'PRO' | 'AGENCY';
  periodStart: string;
  periodEnd: string;
  searchesCount: number;
  maxSearches: number;
  businessesDiscovered: number;
  maxBusinesses: number;
  auditsCount: number;
  maxAudits: number;
  aiAnalysesCount: number;
  maxAiAnalyses: number;
  exportsCount: number;
  maxExports: number;
}

export interface SecurityEvent {
  id: string;
  userId?: string;
  workspaceId?: string;
  eventType:
    | 'SSRF_BLOCKED'
    | 'AUTH_FAILED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'PROMPT_INJECTION_DETECTED'
    | 'CSV_INJECTION_DEFENDED'
    | 'ACCESS_DENIED_IDOR'
    | 'SUSPICIOUS_SIGNUP';
  ipHash: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DiscoveredBusiness {
  name: string;
  category: string;
  street?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  websiteUrl?: string;
  source: 'licensed' | 'open_data' | 'user_csv' | 'manual' | 'google_places_official';
  sourceId?: string;
  sourceUrl?: string;
  confidence: number;
}
