import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { SearchView } from './components/SearchView';
import { BusinessTableView } from './components/BusinessTableView';
import { SecuritySuiteView } from './components/SecuritySuiteView';
import { SettingsView } from './components/SettingsView';
import { BusinessDetailModal } from './components/BusinessDetailModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { CsvImportModal } from './components/CsvImportModal';
import { apiFetch } from './lib/api-client';
import { runClientDiscovery } from './lib/client-pipeline';
import {
  Business,
  Audit,
  Lead,
  SearchRecord,
  LeadStatus,
  AIReport,
  Contact,
  EvidenceRecord,
  DataSourceProvider,
} from './types';

type BusinessWithMeta = Business & {
  audit?: Audit;
  audits?: Audit[];
  lead?: Lead;
  contactsCount: number;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWhatsApp: boolean;
  hasDecisionMaker: boolean;
  contacts?: Contact[];
  evidence?: EvidenceRecord[];
  aiReport?: AIReport;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [businesses, setBusinesses] = useState<BusinessWithMeta[]>([]);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [activeSearch, setActiveSearch] = useState<SearchRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Business for Detailed Dossier
  const [selectedBusinessDetail, setSelectedBusinessDetail] = useState<{
    business: Business;
    audit?: Audit;
    audits?: Audit[];
    aiReport?: AIReport;
    contacts: Contact[];
    evidence: EvidenceRecord[];
    lead?: Lead;
  } | null>(null);

  // Modal open states
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  // Fetch Businesses
  const fetchBusinesses = useCallback(async () => {
    try {
      const data = await apiFetch<{ businesses: BusinessWithMeta[] }>('/api/businesses');
      const serverList = data.businesses || [];
      setBusinesses((prev) => {
        const serverIds = new Set(serverList.map((b) => b.id));
        const clientOnly = prev.filter((b) => !serverIds.has(b.id));
        return [...serverList, ...clientOnly];
      });
    } catch (err) {
      console.error('Failed to load businesses:', err);
    }
  }, []);

  // Fetch Searches
  const fetchSearches = useCallback(async () => {
    try {
      const data = await apiFetch<{ searches: SearchRecord[] }>('/api/searches');
      const list: SearchRecord[] = data.searches || [];
      setSearches((prev) => {
        const serverIds = new Set(list.map((s) => s.id));
        const clientOnly = prev.filter((s) => !serverIds.has(s.id));
        return [...list, ...clientOnly];
      });

      // Check for active processing search
      const active = list.find((s) => s.status === 'PROCESSING');
      if (active) {
        setActiveSearch(active);
      }
    } catch (err) {
      console.error('Failed to load searches:', err);
    }
  }, []);

  // Initial Load with 1.5s max timeout to ensure immediate rendering
  useEffect(() => {
    const maxWait = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([
      Promise.all([fetchBusinesses(), fetchSearches()]),
      maxWait,
    ]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchBusinesses, fetchSearches]);

  // Polling for active search progress
  useEffect(() => {
    if (!activeSearch || activeSearch.status !== 'PROCESSING') return;

    const interval = setInterval(async () => {
      try {
        const data = await apiFetch<{ search: SearchRecord }>(`/api/searches/${activeSearch.id}`, {}, { maxRetries: 1 });
        const updated: SearchRecord = data.search;
        setActiveSearch(updated);

        if (updated.status === 'COMPLETED' || updated.status === 'FAILED') {
          fetchBusinesses();
          fetchSearches();
        }
      } catch {
        // Ignore polling error
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeSearch, fetchBusinesses, fetchSearches]);

  // Execute Search
  const handleExecuteSearch = async (params: {
    country: string;
    city: string;
    radiusKm: number;
    category: string;
    keywords?: string;
    minOpportunityScore: number;
    provider: string;
    apifyToken?: string;
    maxResults?: number;
    onlyWithoutWebsite?: boolean;
    mustHaveWebsite?: boolean;
    requirePhone?: boolean;
    opportunityFocus?: 'all' | 'no_website' | 'performance_mobile' | 'seo_security';
    sortPriority?: 'opportunity_score' | 'conversion_potential' | 'distance';
  }): Promise<SearchRecord> => {
    try {
      const data = await apiFetch<{ search: SearchRecord; businesses?: BusinessWithMeta[] }>(
        '/api/searches',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        },
        {
          maxRetries: 1,
          baseDelayMs: 300,
        }
      );

      const searchRecord: SearchRecord = data.search;
      setActiveSearch(searchRecord);

      if (data.businesses && data.businesses.length > 0) {
        setBusinesses((prev) => {
          const existingIds = new Set(prev.map((b) => b.id));
          const filteredNew = data.businesses!.filter((b) => !existingIds.has(b.id));
          return [...filteredNew, ...prev];
        });
      }

      fetchSearches();
      fetchBusinesses();
      return searchRecord;
    } catch (err) {
      console.warn('Backend search unreachable or in cold-start, activating resilient client engine:', err);
      // Run resilient local discovery engine with real-time progress callbacks
      const { search: localSearch, businesses: localBusinesses } = await runClientDiscovery(
        {
          ...params,
          provider: (params.provider || 'apify_google_maps') as DataSourceProvider,
        },
        (progressSearch) => {
          setActiveSearch({ ...progressSearch });
        }
      );

      setActiveSearch(localSearch);
      setBusinesses((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const filteredNew = localBusinesses.filter((b) => !existingIds.has(b.id));
        return [...filteredNew, ...prev];
      });
      setSearches((prev) => [localSearch, ...prev.filter((s) => s.id !== localSearch.id)]);
      return localSearch;
    }
  };

  // Select a business to view Dossier Modal
  const handleSelectBusiness = async (businessId: string) => {
    try {
      const data = await apiFetch(`/api/businesses/${businessId}`);
      setSelectedBusinessDetail(data);
    } catch (err) {
      console.warn('Failed to load business details from server, checking local records:', err);
      const localBiz = businesses.find((b) => b.id === businessId);
      if (localBiz) {
        setSelectedBusinessDetail({
          business: localBiz,
          audit: localBiz.audit,
          audits: localBiz.audits || (localBiz.audit ? [localBiz.audit] : []),
          aiReport: localBiz.aiReport,
          contacts: localBiz.contacts || [],
          evidence: localBiz.evidence || [],
          lead: localBiz.lead,
        });
      }
    }
  };

  // Update Lead Status
  const handleUpdateLeadStatus = async (leadId: string, status: LeadStatus) => {
    // Optimistic local update
    setBusinesses((prev) =>
      prev.map((b) => (b.lead?.id === leadId ? { ...b, lead: { ...b.lead, status } } : b))
    );

    if (selectedBusinessDetail && selectedBusinessDetail.lead?.id === leadId) {
      setSelectedBusinessDetail({
        ...selectedBusinessDetail,
        lead: { ...selectedBusinessDetail.lead, status },
      });
    }

    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchBusinesses();
    } catch (err) {
      console.warn('Backend sync failed, updated locally:', err);
    }
  };

  // Update Lead Details (Notes, follow-up date)
  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    // Optimistic local update
    setBusinesses((prev) =>
      prev.map((b) => (b.lead?.id === leadId ? { ...b, lead: { ...b.lead, ...updates } } : b))
    );

    if (selectedBusinessDetail && selectedBusinessDetail.lead?.id === leadId) {
      setSelectedBusinessDetail({
        ...selectedBusinessDetail,
        lead: { ...selectedBusinessDetail.lead, ...updates },
      });
    }

    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchBusinesses();
    } catch (err) {
      console.warn('Backend sync failed, updated locally:', err);
    }
  };

  // Suppress Business (DO_NOT_CONTACT)
  const handleSuppressBusiness = async (businessId: string) => {
    try {
      await apiFetch(`/api/businesses/${businessId}/suppress`, { method: 'POST' });
      fetchBusinesses();
      setSelectedBusinessDetail(null);
    } catch (err) {
      console.error('Failed to suppress business:', err);
    }
  };

  // Delete Business
  const handleDeleteBusiness = async (businessId: string) => {
    try {
      await apiFetch(`/api/businesses/${businessId}`, { method: 'DELETE' });
      fetchBusinesses();
      setSelectedBusinessDetail(null);
    } catch (err) {
      console.error('Failed to delete business:', err);
    }
  };

  // Bulk Lead Status Update
  const handleBulkUpdateStatus = async (businessIds: string[], status: LeadStatus) => {
    try {
      await apiFetch('/api/leads/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds, status }),
      });
      await fetchBusinesses();
    } catch (err) {
      console.error('Failed to bulk update status:', err);
    }
  };

  // Bulk Suppress Businesses
  const handleBulkSuppress = async (businessIds: string[]) => {
    try {
      await apiFetch('/api/businesses/bulk-suppress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds }),
      });
      await fetchBusinesses();
    } catch (err) {
      console.error('Failed to bulk suppress businesses:', err);
    }
  };

  // Bulk Delete Businesses
  const handleBulkDelete = async (businessIds: string[]) => {
    try {
      await apiFetch('/api/businesses/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds }),
      });
      await fetchBusinesses();
    } catch (err) {
      console.error('Failed to bulk delete businesses:', err);
    }
  };

  // Bulk Add Tag
  const handleBulkAddTag = async (businessIds: string[], tag: string) => {
    try {
      await apiFetch('/api/leads/bulk-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds, tag }),
      });
      await fetchBusinesses();
    } catch (err) {
      console.error('Failed to bulk add tag:', err);
    }
  };

  // Manual Single Business Entry
  const handleManualAddBusiness = async (data: {
    name: string;
    category: string;
    city: string;
    country: string;
    street?: string;
    websiteUrl?: string;
    phone?: string;
  }) => {
    await apiFetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    await fetchBusinesses();
  };

  // CSV Import
  const handleCsvImport = async (csvText: string): Promise<number> => {
    const data = await apiFetch<{ importedCount: number }>('/api/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText }),
    });

    await fetchBusinesses();
    return data.importedCount;
  };

  // Export CSV
  const handleExportCsv = () => {
    window.location.href = '/api/export/csv';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewSearch={() => setActiveTab('search')}
        onOpenManualEntry={() => setIsManualEntryOpen(true)}
        onOpenCsvImport={() => setIsCsvImportOpen(true)}
        onExportCsv={handleExportCsv}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-xs text-zinc-500">
            Initializing workspace data...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                businesses={businesses}
                onSelectBusiness={handleSelectBusiness}
                onNavigateToSearch={() => setActiveTab('search')}
                onNavigateToLeads={() => setActiveTab('leads')}
              />
            )}

            {activeTab === 'search' && (
              <SearchView
                onExecuteSearch={handleExecuteSearch}
                activeSearch={activeSearch}
                recentSearches={searches}
                onViewResults={() => setActiveTab('leads')}
              />
            )}

            {activeTab === 'leads' && (
              <BusinessTableView
                businesses={businesses}
                onSelectBusiness={handleSelectBusiness}
                onUpdateLeadStatus={handleUpdateLeadStatus}
                onBulkUpdateStatus={handleBulkUpdateStatus}
                onBulkSuppress={handleBulkSuppress}
                onBulkDelete={handleBulkDelete}
                onBulkAddTag={handleBulkAddTag}
                onExportCsv={handleExportCsv}
                onOpenNewSearch={() => setActiveTab('search')}
              />
            )}

            {activeTab === 'security' && <SecuritySuiteView />}

            {activeTab === 'settings' && <SettingsView />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950/80 py-4 text-center text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI Local Business Opportunity Finder &bull; Production Full-Stack Architecture</span>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>SSRF-Shielded Crawler</span>
            <span>&bull;</span>
            <span>PageSpeed Core Web Vitals</span>
            <span>&bull;</span>
            <span>Gemini 3.8 Intelligence</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedBusinessDetail && (
        <BusinessDetailModal
          business={selectedBusinessDetail.business}
          audit={selectedBusinessDetail.audit}
          audits={selectedBusinessDetail.audits}
          aiReport={selectedBusinessDetail.aiReport}
          contacts={selectedBusinessDetail.contacts}
          evidence={selectedBusinessDetail.evidence}
          lead={selectedBusinessDetail.lead}
          onClose={() => setSelectedBusinessDetail(null)}
          onUpdateLead={handleUpdateLead}
          onSuppressBusiness={handleSuppressBusiness}
          onDeleteBusiness={handleDeleteBusiness}
        />
      )}

      {isManualEntryOpen && (
        <ManualEntryModal
          onClose={() => setIsManualEntryOpen(false)}
          onSubmit={handleManualAddBusiness}
        />
      )}

      {isCsvImportOpen && (
        <CsvImportModal
          onClose={() => setIsCsvImportOpen(false)}
          onImport={handleCsvImport}
        />
      )}
    </div>
  );
}
