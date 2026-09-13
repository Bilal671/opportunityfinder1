import {
  User,
  Workspace,
  Business,
  Website,
  Audit,
  Contact,
  EvidenceRecord,
  AIReport,
  Lead,
  LeadStatus,
  SavedSearch,
  UsageQuota,
  SearchRecord,
} from '../../types';

interface DatabaseState {
  users: Map<string, User & { passwordHash: string }>;
  workspaces: Map<string, Workspace>;
  searches: Map<string, SearchRecord>;
  businesses: Map<string, Business>;
  websites: Map<string, Website>;
  audits: Map<string, Audit>;
  contacts: Map<string, Contact>;
  evidence: Map<string, EvidenceRecord>;
  aiReports: Map<string, AIReport>;
  leads: Map<string, Lead>;
  savedSearches: Map<string, SavedSearch>;
  quotas: Map<string, UsageQuota>;
  workspaceSettings: Map<string, Record<string, string>>;
}

// In-memory persistent state across requests
const db: DatabaseState = {
  users: new Map(),
  workspaces: new Map(),
  searches: new Map(),
  businesses: new Map(),
  websites: new Map(),
  audits: new Map(),
  contacts: new Map(),
  evidence: new Map(),
  aiReports: new Map(),
  leads: new Map(),
  savedSearches: new Map(),
  quotas: new Map(),
  workspaceSettings: new Map(),
};

// Initialize demo seed data
function seedInitialData() {
  // Demo user
  const demoUserId = 'usr_demo_001';
  const demoWorkspaceId = 'ws_demo_001';

  db.users.set(demoUserId, {
    id: demoUserId,
    email: 'mohammadbilal671@gmail.com',
    fullName: 'Bilal Mohammad',
    isEmailVerified: true,
    role: 'owner',
    createdAt: new Date().toISOString(),
    passwordHash: 'demo_password_hash_secure',
  });

  db.workspaces.set(demoWorkspaceId, {
    id: demoWorkspaceId,
    name: 'Main Agency Workspace',
    ownerId: demoUserId,
    plan: 'PRO',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.quotas.set(demoWorkspaceId, {
    workspaceId: demoWorkspaceId,
    plan: 'PRO',
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    searchesCount: 0,
    maxSearches: 100,
    businessesDiscovered: 0,
    maxBusinesses: 5000,
    auditsCount: 0,
    maxAudits: 500,
    aiAnalysesCount: 0,
    maxAiAnalyses: 250,
    exportsCount: 0,
    maxExports: 50,
  });
}

// Seed upon module load
seedInitialData();

/**
 * Storage Layer with RLS and Workspace isolation.
 */
export const store = {
  // Users & Auth
  getUserByEmail(email: string) {
    const normalized = email.toLowerCase().trim();
    for (const u of db.users.values()) {
      if (u.email.toLowerCase() === normalized) return u;
    }
    return null;
  },

  getUserById(id: string) {
    return db.users.get(id) || null;
  },

  createUser(user: User & { passwordHash: string }) {
    db.users.set(user.id, user);
    return user;
  },

  // Workspaces (RLS: User must be owner or member)
  getWorkspaceById(id: string, userId: string) {
    const ws = db.workspaces.get(id);
    if (!ws) return null;
    // RLS check
    if (ws.ownerId !== userId) {
      return null;
    }
    return ws;
  },

  getUserWorkspaces(userId: string) {
    const list: Workspace[] = [];
    for (const ws of db.workspaces.values()) {
      if (ws.ownerId === userId) {
        list.push(ws);
      }
    }
    return list;
  },

  createWorkspace(ws: Workspace) {
    db.workspaces.set(ws.id, ws);
    return ws;
  },

  // Quotas
  getQuota(workspaceId: string): UsageQuota {
    let quota = db.quotas.get(workspaceId);
    if (!quota) {
      quota = {
        workspaceId,
        plan: 'FREE',
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        searchesCount: 0,
        maxSearches: 10,
        businessesDiscovered: 0,
        maxBusinesses: 50,
        auditsCount: 0,
        maxAudits: 5,
        aiAnalysesCount: 0,
        maxAiAnalyses: 5,
        exportsCount: 0,
        maxExports: 3,
      };
      db.quotas.set(workspaceId, quota);
    }
    return quota;
  },

  updateQuota(workspaceId: string, updates: Partial<UsageQuota>) {
    const current = this.getQuota(workspaceId);
    const updated = { ...current, ...updates };
    db.quotas.set(workspaceId, updated);
    return updated;
  },

  // Searches
  createSearch(search: SearchRecord) {
    db.searches.set(search.id, search);
    return search;
  },

  getSearch(id: string, workspaceId: string) {
    const search = db.searches.get(id);
    if (!search || search.workspaceId !== workspaceId) return null;
    return search;
  },

  updateSearch(id: string, updates: Partial<SearchRecord>) {
    const search = db.searches.get(id);
    if (!search) return null;
    const updated = { ...search, ...updates };
    db.searches.set(id, updated);
    return updated;
  },

  getWorkspaceSearches(workspaceId: string) {
    const list: SearchRecord[] = [];
    for (const s of db.searches.values()) {
      if (s.workspaceId === workspaceId) {
        list.push(s);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // Businesses (RLS: Workspace scoped)
  getBusinesses(workspaceId: string) {
    const list: Business[] = [];
    for (const b of db.businesses.values()) {
      if (b.workspaceId === workspaceId && !b.isSuppressed) {
        list.push(b);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getBusinessById(id: string, workspaceId: string) {
    const b = db.businesses.get(id);
    if (!b || b.workspaceId !== workspaceId) return null;
    return b;
  },

  saveBusiness(business: Business) {
    db.businesses.set(business.id, business);
    return business;
  },

  suppressBusiness(id: string, workspaceId: string) {
    const b = this.getBusinessById(id, workspaceId);
    if (!b) return false;
    b.isSuppressed = true;
    b.updatedAt = new Date().toISOString();
    return true;
  },

  deleteBusiness(id: string, workspaceId: string) {
    const b = this.getBusinessById(id, workspaceId);
    if (!b) return false;
    db.businesses.delete(id);
    return true;
  },

  // Audits & Reports
  getLatestAuditForBusiness(businessId: string) {
    let latest: Audit | null = null;
    for (const a of db.audits.values()) {
      if (a.businessId === businessId) {
        if (!latest || new Date(a.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
          latest = a;
        }
      }
    }
    return latest;
  },

  getAuditsForBusiness(businessId: string): Audit[] {
    const list: Audit[] = [];
    for (const a of db.audits.values()) {
      if (a.businessId === businessId) {
        list.push(a);
      }
    }
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  saveAudit(audit: Audit) {
    db.audits.set(audit.id, audit);
    return audit;
  },

  getLatestAIReportForBusiness(businessId: string) {
    for (const r of db.aiReports.values()) {
      if (r.businessId === businessId) return r;
    }
    return null;
  },

  saveAIReport(report: AIReport) {
    db.aiReports.set(report.id, report);
    return report;
  },

  // Contacts & Evidence
  getContactsForBusiness(businessId: string) {
    const list: Contact[] = [];
    for (const c of db.contacts.values()) {
      if (c.businessId === businessId && !c.isSuppressed) {
        list.push(c);
      }
    }
    return list;
  },

  saveContact(contact: Contact) {
    db.contacts.set(contact.id, contact);
    return contact;
  },

  getEvidenceForBusiness(businessId: string) {
    const list: EvidenceRecord[] = [];
    for (const e of db.evidence.values()) {
      if (e.businessId === businessId) {
        list.push(e);
      }
    }
    return list;
  },

  saveEvidence(evidence: EvidenceRecord) {
    db.evidence.set(evidence.id, evidence);
    return evidence;
  },

  // Leads
  getLeadForBusiness(businessId: string, workspaceId: string) {
    for (const l of db.leads.values()) {
      if (l.businessId === businessId && l.workspaceId === workspaceId) {
        return l;
      }
    }
    return null;
  },

  saveLead(lead: Lead) {
    db.leads.set(lead.id, lead);
    return lead;
  },

  updateLead(id: string, workspaceId: string, updates: Partial<Lead>) {
    const lead = db.leads.get(id);
    if (!lead || lead.workspaceId !== workspaceId) return null;
    const updated = { ...lead, ...updates, updatedAt: new Date().toISOString() };
    db.leads.set(id, updated);
    return updated;
  },

  bulkUpdateLeadStatus(businessIds: string[], workspaceId: string, status: LeadStatus) {
    const updatedList: Lead[] = [];
    for (const businessId of businessIds) {
      const b = this.getBusinessById(businessId, workspaceId);
      if (!b) continue;

      let lead = this.getLeadForBusiness(businessId, workspaceId);
      if (lead) {
        lead.status = status;
        lead.updatedAt = new Date().toISOString();
        db.leads.set(lead.id, lead);
        updatedList.push(lead);
      } else {
        const newLead: Lead = {
          id: `lead_${businessId}`,
          workspaceId,
          businessId,
          status,
          notes: '',
          tags: [],
          categories: [b.category],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.leads.set(newLead.id, newLead);
        updatedList.push(newLead);
      }
    }
    return updatedList;
  },

  bulkAddTagToLeads(businessIds: string[], workspaceId: string, tag: string) {
    const cleanTag = tag.trim().toLowerCase();
    if (!cleanTag) return [];
    const updatedList: Lead[] = [];
    for (const businessId of businessIds) {
      let lead = this.getLeadForBusiness(businessId, workspaceId);
      if (lead) {
        if (!lead.tags.includes(cleanTag)) {
          lead.tags = [...lead.tags, cleanTag];
          lead.updatedAt = new Date().toISOString();
          db.leads.set(lead.id, lead);
        }
        updatedList.push(lead);
      } else {
        const newLead: Lead = {
          id: `lead_${businessId}`,
          workspaceId,
          businessId,
          status: 'NEW',
          notes: '',
          tags: [cleanTag],
          categories: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.leads.set(newLead.id, newLead);
        updatedList.push(newLead);
      }
    }
    return updatedList;
  },

  bulkDeleteBusinesses(businessIds: string[], workspaceId: string) {
    let count = 0;
    for (const id of businessIds) {
      if (this.deleteBusiness(id, workspaceId)) {
        count++;
      }
    }
    return count;
  },

  bulkSuppressBusinesses(businessIds: string[], workspaceId: string) {
    let count = 0;
    for (const id of businessIds) {
      if (this.suppressBusiness(id, workspaceId)) {
        count++;
      }
    }
    return count;
  },

  // Saved searches
  getSavedSearches(workspaceId: string) {
    const list: SavedSearch[] = [];
    for (const s of db.savedSearches.values()) {
      if (s.workspaceId === workspaceId) {
        list.push(s);
      }
    }
    return list;
  },

  createSavedSearch(s: SavedSearch) {
    db.savedSearches.set(s.id, s);
    return s;
  },

  deleteSavedSearch(id: string, workspaceId: string) {
    const s = db.savedSearches.get(id);
    if (!s || s.workspaceId !== workspaceId) return false;
    db.savedSearches.delete(id);
    return true;
  },

  // Workspace Settings / In-app API Tokens
  getWorkspaceSetting(workspaceId: string, key: string): string | undefined {
    const settings = db.workspaceSettings.get(workspaceId);
    return settings ? settings[key] : undefined;
  },

  setWorkspaceSetting(workspaceId: string, key: string, value: string): void {
    const existing = db.workspaceSettings.get(workspaceId) || {};
    existing[key] = value;
    db.workspaceSettings.set(workspaceId, existing);
  },
};
