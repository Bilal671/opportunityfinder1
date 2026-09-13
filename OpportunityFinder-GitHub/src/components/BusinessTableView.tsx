import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  Mail,
  Phone,
  MessageSquare,
  UserCheck,
  Globe,
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
  Download,
  Filter,
  Eye,
  CheckSquare,
  Square,
  MinusSquare,
  Check,
  X,
  Tag,
  Trash2,
  ShieldAlert,
  Sparkles,
  Loader2,
  ChevronDown,
  Layers,
  Send,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Business, Audit, Lead, LeadStatus, WebsiteStatus } from '../types';
import { apiFetch } from '../lib/api-client';

interface BusinessTableViewProps {
  businesses: Array<
    Business & {
      audit?: Audit;
      lead?: Lead;
      contactsCount: number;
      hasEmail: boolean;
      hasPhone: boolean;
      hasWhatsApp: boolean;
      hasDecisionMaker: boolean;
    }
  >;
  onSelectBusiness: (id: string) => void;
  onUpdateLeadStatus: (leadId: string, status: LeadStatus) => void;
  onBulkUpdateStatus?: (businessIds: string[], status: LeadStatus) => Promise<void>;
  onBulkSuppress?: (businessIds: string[]) => Promise<void>;
  onBulkDelete?: (businessIds: string[]) => Promise<void>;
  onBulkAddTag?: (businessIds: string[], tag: string) => Promise<void>;
  onExportCsv: () => void;
  onOpenNewSearch: () => void;
}

const LEAD_STATUS_OPTIONS: Array<{ value: LeadStatus; label: string; color: string }> = [
  { value: 'NEW', label: 'New', color: 'text-zinc-300' },
  { value: 'REVIEWING', label: 'Reviewing', color: 'text-amber-400' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'text-emerald-400' },
  { value: 'CONTACTED', label: 'Contacted', color: 'text-indigo-400' },
  { value: 'REPLIED', label: 'Replied', color: 'text-cyan-400' },
  { value: 'MEETING', label: 'Meeting Scheduled', color: 'text-purple-400' },
  { value: 'PROPOSAL', label: 'Proposal Sent', color: 'text-fuchsia-400' },
  { value: 'WON', label: 'Won', color: 'text-emerald-300 font-bold' },
  { value: 'LOST', label: 'Lost', color: 'text-rose-400' },
  { value: 'DO_NOT_CONTACT', label: 'Do Not Contact', color: 'text-red-500' },
];

const PRESET_TAGS = ['priority', 'hot-lead', 'local-seo', 'needs-redesign', 'high-budget'];

export const BusinessTableView: React.FC<BusinessTableViewProps> = ({
  businesses,
  onSelectBusiness,
  onUpdateLeadStatus,
  onBulkUpdateStatus,
  onBulkSuppress,
  onBulkDelete,
  onBulkAddTag,
  onExportCsv,
  onOpenNewSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWebsiteStatus, setSelectedWebsiteStatus] = useState<string>('ALL');
  const [selectedLeadStatus, setSelectedLeadStatus] = useState<string>('ALL');
  const [minOpportunityScore, setMinOpportunityScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'opp_desc' | 'opp_asc' | 'health_asc' | 'name_asc'>('opp_desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Quick actions state
  const [bulkTargetStatus, setBulkTargetStatus] = useState<LeadStatus>('QUALIFIED');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification({ message, type });
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    businesses.forEach((b) => set.add(b.category));
    return Array.from(set).sort();
  }, [businesses]);

  // Filtered & Sorted businesses
  const filteredBusinesses = useMemo(() => {
    return businesses
      .filter((b) => {
        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchName = b.name.toLowerCase().includes(term);
          const matchCity = b.city.toLowerCase().includes(term);
          const matchCat = b.category.toLowerCase().includes(term);
          if (!matchName && !matchCity && !matchCat) return false;
        }

        // Category filter
        if (selectedCategory !== 'ALL' && b.category !== selectedCategory) {
          return false;
        }

        // Website status filter
        if (selectedWebsiteStatus !== 'ALL' && b.websiteStatus !== selectedWebsiteStatus) {
          return false;
        }

        // Lead status filter
        if (selectedLeadStatus !== 'ALL') {
          const leadSt = b.lead?.status ?? 'NEW';
          if (leadSt !== selectedLeadStatus) return false;
        }

        // Min Opportunity Score
        const oppScore = b.audit?.opportunityScore ?? 0;
        if (oppScore < minOpportunityScore) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const oppA = a.audit?.opportunityScore ?? 0;
        const oppB = b.audit?.opportunityScore ?? 0;
        const healthA = a.audit?.websiteHealthScore ?? 0;
        const healthB = b.audit?.websiteHealthScore ?? 0;

        if (sortBy === 'opp_desc') return oppB - oppA;
        if (sortBy === 'opp_asc') return oppA - oppB;
        if (sortBy === 'health_asc') return healthA - healthB;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [businesses, searchTerm, selectedCategory, selectedWebsiteStatus, selectedLeadStatus, minOpportunityScore, sortBy]);

  // Selection helpers
  const isAllFilteredSelected =
    filteredBusinesses.length > 0 &&
    filteredBusinesses.every((b) => selectedIds.has(b.id));

  const isSomeFilteredSelected =
    selectedIds.size > 0 && !isAllFilteredSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredBusinesses.map((b) => b.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setShowTagMenu(false);
    setShowDeleteConfirm(false);
  };

  // Bulk Operations
  const handleBulkAssignStatus = async (statusOverride?: LeadStatus) => {
    const status = statusOverride || bulkTargetStatus;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsProcessingBulk(true);
    try {
      if (onBulkUpdateStatus) {
        await onBulkUpdateStatus(ids, status);
      } else {
        await apiFetch('/api/leads/bulk-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessIds: ids, status }),
        });
      }

      showNotification(
        `Successfully updated status to "${status.replace(/_/g, ' ')}" for ${ids.length} ${ids.length === 1 ? 'business' : 'businesses'}.`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed bulk status update';
      showNotification(msg, 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkAddTag = async (tag: string) => {
    const cleanTag = tag.trim().toLowerCase();
    if (!cleanTag) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsProcessingBulk(true);
    try {
      if (onBulkAddTag) {
        await onBulkAddTag(ids, cleanTag);
      } else {
        await apiFetch('/api/leads/bulk-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessIds: ids, tag: cleanTag }),
        });
      }

      setCustomTagInput('');
      setShowTagMenu(false);
      showNotification(`Added tag "${cleanTag}" to ${ids.length} businesses.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to tag leads';
      showNotification(msg, 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkSuppress = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsProcessingBulk(true);
    try {
      if (onBulkSuppress) {
        await onBulkSuppress(ids);
      } else {
        await apiFetch('/api/businesses/bulk-suppress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessIds: ids }),
        });
      }

      handleClearSelection();
      showNotification(`Marked ${ids.length} businesses as Do Not Contact & suppressed.`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to suppress businesses';
      showNotification(msg, 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsProcessingBulk(true);
    try {
      if (onBulkDelete) {
        await onBulkDelete(ids);
      } else {
        await apiFetch('/api/businesses/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessIds: ids }),
        });
      }

      handleClearSelection();
      showNotification(`Deleted ${ids.length} businesses from database.`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete businesses';
      showNotification(msg, 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleExportSelectedCsv = () => {
    const selectedList = businesses.filter((b) => selectedIds.has(b.id));
    if (selectedList.length === 0) return;

    const headers = [
      'ID',
      'Name',
      'Category',
      'City',
      'Country',
      'Website',
      'Website Status',
      'Health Score',
      'Mobile Score',
      'Opportunity Score',
      'Lead Status',
      'Email Available',
      'Phone Available',
      'WhatsApp Available',
      'Decision Maker Found',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = selectedList.map((b) => [
      escapeCsv(b.id),
      escapeCsv(b.name),
      escapeCsv(b.category),
      escapeCsv(b.city),
      escapeCsv(b.country),
      escapeCsv(b.websiteUrl || 'N/A'),
      escapeCsv(b.websiteStatus),
      escapeCsv(b.audit?.websiteHealthScore ?? 0),
      escapeCsv(b.audit?.mobileScore ?? 0),
      escapeCsv(b.audit?.opportunityScore ?? 0),
      escapeCsv(b.lead?.status ?? 'NEW'),
      escapeCsv(b.hasEmail ? 'Yes' : 'No'),
      escapeCsv(b.hasPhone ? 'Yes' : 'No'),
      escapeCsv(b.hasWhatsApp ? 'Yes' : 'No'),
      escapeCsv(b.hasDecisionMaker ? 'Yes' : 'No'),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selected_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification(`Exported ${selectedList.length} selected businesses to CSV.`, 'success');
  };

  // Helper for Opportunity Badge
  const getOpportunityBadge = (score: number) => {
    if (score >= 90) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20">
          Very High ({score})
        </span>
      );
    }
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
          High ({score})
        </span>
      );
    }
    if (score >= 60) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
          Good ({score})
        </span>
      );
    }
    if (score >= 40) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
          Medium ({score})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400 border border-zinc-700">
        Low ({score})
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Discovered Local Opportunities
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Showing {filteredBusinesses.length} of {businesses.length} analyzed business leads
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="text-xs text-indigo-400 font-medium mr-2 flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedIds.size} selected
            </span>
          )}
          <button
            id="export-all-csv-btn"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export All CSV
          </button>
          <button
            id="new-scan-btn"
            onClick={onOpenNewSearch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
          >
            New Scan
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search text */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              id="filter-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search business, city..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              id="filter-category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Website Status Filter */}
          <div>
            <select
              id="filter-website-status-select"
              value={selectedWebsiteStatus}
              onChange={(e) => setSelectedWebsiteStatus(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Website Statuses</option>
              <option value="NO_WEBSITE">No Website Found (High Opp)</option>
              <option value="WEBSITE_FOUND">Website Online</option>
              <option value="WEBSITE_DOWN">Website Offline / Error</option>
            </select>
          </div>

          {/* Lead Status Filter */}
          <div>
            <select
              id="filter-lead-status-select"
              value={selectedLeadStatus}
              onChange={(e) => setSelectedLeadStatus(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Lead Statuses</option>
              <option value="NEW">New</option>
              <option value="REVIEWING">Reviewing</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="CONTACTED">Contacted</option>
              <option value="REPLIED">Replied</option>
              <option value="MEETING">Meeting Scheduled</option>
              <option value="PROPOSAL">Proposal Sent</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
              <option value="DO_NOT_CONTACT">Do Not Contact</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              id="filter-sort-by-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="opp_desc">Sort: Highest Opportunity</option>
              <option value="opp_asc">Sort: Lowest Opportunity</option>
              <option value="health_asc">Sort: Weakest Website Health</option>
              <option value="name_asc">Sort: Business Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Min Score Slider */}
        <div className="flex items-center gap-3 pt-1 text-xs text-zinc-400">
          <span className="shrink-0">Filter Min Opportunity:</span>
          <input
            id="min-opp-slider"
            type="range"
            min="0"
            max="90"
            step="5"
            value={minOpportunityScore}
            onChange={(e) => setMinOpportunityScore(Number(e.target.value))}
            className="w-48 accent-indigo-500"
          />
          <span className="font-semibold text-indigo-400">{minOpportunityScore}+</span>
          {minOpportunityScore > 0 && (
            <button
              onClick={() => setMinOpportunityScore(0)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Floating/Inline Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2 text-xs shadow-lg backdrop-blur-md ${
              notification.type === 'error'
                ? 'border-rose-500/40 bg-rose-950/80 text-rose-200'
                : notification.type === 'info'
                ? 'border-cyan-500/40 bg-cyan-950/80 text-cyan-200'
                : 'border-emerald-500/40 bg-emerald-950/80 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-zinc-400 hover:text-zinc-200 text-xs p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* QUICK ACTIONS TOOLBAR (Appears when businesses are selected)               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            id="quick-actions-toolbar"
            initial={{ opacity: 0, y: -12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.99 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="sticky top-3 z-30 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-indigo-950/90 p-3.5 shadow-2xl shadow-indigo-950/60 backdrop-blur-xl"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left: Selection Counter & Bulk Controls */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 text-xs">
                  <CheckSquare className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold text-white">{selectedIds.size}</span>
                  <span className="text-zinc-300">selected</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  {!isAllFilteredSelected ? (
                    <button
                      id="quick-action-select-all-btn"
                      onClick={() => handleSelectAll(true)}
                      className="rounded px-2 py-0.5 text-[11px] font-medium text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-colors"
                    >
                      Select all {filteredBusinesses.length} in view
                    </button>
                  ) : (
                    <button
                      onClick={handleClearSelection}
                      className="rounded px-2 py-0.5 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      Deselect all
                    </button>
                  )}
                </div>
              </div>

              {/* Center: Assign Status (Dropdown + 1-Click Status Chips) */}
              <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 border-zinc-800/80 pt-2 lg:pt-0">
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Assign Status:</span>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center gap-1">
                  <select
                    id="quick-action-status-select"
                    value={bulkTargetStatus}
                    onChange={(e) => setBulkTargetStatus(e.target.value as LeadStatus)}
                    disabled={isProcessingBulk}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-100 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  >
                    {LEAD_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    id="quick-action-apply-status-btn"
                    onClick={() => handleBulkAssignStatus()}
                    disabled={isProcessingBulk}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isProcessingBulk ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Apply
                  </button>
                </div>

                {/* One-Click Shortcut Pills */}
                <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-zinc-800">
                  <button
                    id="quick-chip-qualified-btn"
                    onClick={() => handleBulkAssignStatus('QUALIFIED')}
                    disabled={isProcessingBulk}
                    title="Mark all selected as Qualified"
                    className="rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300 transition-colors"
                  >
                    Qualified
                  </button>
                  <button
                    id="quick-chip-contacted-btn"
                    onClick={() => handleBulkAssignStatus('CONTACTED')}
                    disabled={isProcessingBulk}
                    title="Mark all selected as Contacted"
                    className="rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-medium text-indigo-300 transition-colors"
                  >
                    Contacted
                  </button>
                  <button
                    id="quick-chip-reviewing-btn"
                    onClick={() => handleBulkAssignStatus('REVIEWING')}
                    disabled={isProcessingBulk}
                    title="Mark all selected as Reviewing"
                    className="rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-300 transition-colors"
                  >
                    Reviewing
                  </button>
                </div>
              </div>

              {/* Right: Secondary Bulk Tools & Dismiss */}
              <div className="flex items-center gap-2 border-t lg:border-t-0 border-zinc-800/80 pt-2 lg:pt-0">
                {/* Export Selected CSV */}
                <button
                  id="quick-action-export-csv-btn"
                  onClick={handleExportSelectedCsv}
                  title="Export only selected rows to CSV"
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Export</span> ({selectedIds.size})
                </button>

                {/* Add Tag Dropdown/Popover */}
                <div className="relative">
                  <button
                    id="quick-action-tag-toggle-btn"
                    onClick={() => setShowTagMenu(!showTagMenu)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors"
                  >
                    <Tag className="h-3.5 w-3.5 text-purple-400" />
                    <span>Tag</span>
                    <ChevronDown className="h-3 w-3 text-zinc-400" />
                  </button>

                  {showTagMenu && (
                    <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-xl backdrop-blur-md z-40 space-y-2.5">
                      <div className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                        <span>Tag {selectedIds.size} Selected</span>
                        <button
                          onClick={() => setShowTagMenu(false)}
                          className="text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Custom tag input */}
                      <div className="flex items-center gap-1">
                        <input
                          id="quick-action-custom-tag-input"
                          type="text"
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleBulkAddTag(customTagInput);
                          }}
                          placeholder="e.g. priority, q3..."
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handleBulkAddTag(customTagInput)}
                          disabled={!customTagInput.trim()}
                          className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-500 disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>

                      {/* Preset tag chips */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          Preset Tags
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_TAGS.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => handleBulkAddTag(tag)}
                              className="rounded bg-zinc-900 hover:bg-purple-950/80 border border-zinc-800 hover:border-purple-500/40 px-1.5 py-0.5 text-[10px] text-zinc-300 transition-colors"
                            >
                              +{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suppress (Do Not Contact) */}
                <button
                  id="quick-action-suppress-btn"
                  onClick={handleBulkSuppress}
                  title="Mark as Do Not Contact & Suppress from Outreach"
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-red-950/40 hover:border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Suppress</span>
                </button>

                {/* Delete / Remove Selected with Confirmation */}
                <div className="relative">
                  {!showDeleteConfirm ? (
                    <button
                      id="quick-action-delete-btn"
                      onClick={() => setShowDeleteConfirm(true)}
                      title="Permanently remove selected businesses"
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-rose-950/40 hover:border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-500/50 rounded-lg p-1">
                      <span className="text-[10px] text-rose-200 px-1">Delete {selectedIds.size}?</span>
                      <button
                        id="quick-action-confirm-delete-btn"
                        onClick={handleBulkDelete}
                        className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-500"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>

                {/* Clear Selection Button */}
                <button
                  id="quick-action-clear-selection-btn"
                  onClick={handleClearSelection}
                  title="Clear selection"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    id="select-all-checkbox"
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isSomeFilteredSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 accent-indigo-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Business / Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Website Presence</th>
                <th className="px-4 py-3 text-center">Health</th>
                <th className="px-4 py-3 text-center">Mobile</th>
                <th className="px-4 py-3 text-center">Opportunity</th>
                <th className="px-4 py-3 text-center">Contacts</th>
                <th className="px-4 py-3">Lead Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
                    No businesses match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((b) => {
                  const audit = b.audit;
                  const oppScore = audit?.opportunityScore ?? 0;
                  const healthScore = audit?.websiteHealthScore ?? 0;
                  const mobileScore = audit?.mobileScore ?? 0;
                  const isSelected = selectedIds.has(b.id);
                  const leadStatus = b.lead?.status ?? 'NEW';

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/30 border-l-2 border-l-indigo-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          id={`select-biz-checkbox-${b.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(b.id)}
                          className="rounded border-zinc-700 bg-zinc-900 accent-indigo-600 cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div
                          className="font-medium text-zinc-100 hover:text-indigo-400 cursor-pointer transition-colors"
                          onClick={() => onSelectBusiness(b.id)}
                        >
                          {b.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-zinc-500">{b.category}</span>
                          {b.lead?.tags && b.lead.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {b.lead.tags.slice(0, 2).map((t) => (
                                <span
                                  key={t}
                                  className="rounded bg-zinc-800 px-1 py-0.2 text-[9px] text-zinc-400"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-zinc-300">{b.city}</div>
                        <div className="text-[11px] text-zinc-500">{b.country}</div>
                      </td>

                      <td className="px-4 py-3">
                        {b.websiteStatus === 'NO_WEBSITE' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            No Website
                          </span>
                        ) : b.websiteStatus === 'WEBSITE_DOWN' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            Website Down
                          </span>
                        ) : (
                          <a
                            href={b.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-zinc-300 hover:text-indigo-400 transition-colors max-w-[140px] truncate"
                          >
                            <Globe className="h-3 w-3 text-zinc-500 shrink-0" />
                            <span className="truncate">{b.websiteUrl?.replace(/^https?:\/\//, '')}</span>
                          </a>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            healthScore === 0
                              ? 'text-zinc-500'
                              : healthScore < 40
                              ? 'text-rose-400'
                              : healthScore < 65
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {healthScore}/100
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            mobileScore === 0
                              ? 'text-zinc-500'
                              : mobileScore < 50
                              ? 'text-rose-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {mobileScore}/100
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {getOpportunityBadge(oppScore)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-zinc-400">
                          {b.hasEmail && <Mail className="h-3.5 w-3.5 text-emerald-400" title="Email found" />}
                          {b.hasPhone && <Phone className="h-3.5 w-3.5 text-indigo-400" title="Phone found" />}
                          {b.hasWhatsApp && <MessageSquare className="h-3.5 w-3.5 text-emerald-400" title="WhatsApp found" />}
                          {b.hasDecisionMaker && <UserCheck className="h-3.5 w-3.5 text-purple-400" title="Managing Director found" />}
                          {!b.hasEmail && !b.hasPhone && !b.hasWhatsApp && (
                            <span className="text-zinc-600 text-[10px]">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          id={`lead-status-select-${b.id}`}
                          value={leadStatus}
                          onChange={(e) => {
                            if (b.lead?.id) {
                              onUpdateLeadStatus(b.lead.id, e.target.value as LeadStatus);
                            }
                          }}
                          className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 focus:border-indigo-500 focus:outline-none"
                        >
                          {LEAD_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          id={`view-dossier-btn-${b.id}`}
                          onClick={() => onSelectBusiness(b.id)}
                          className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:text-white transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
