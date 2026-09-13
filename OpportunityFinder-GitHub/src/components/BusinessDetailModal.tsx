import React, { useState } from 'react';
import {
  X,
  Building2,
  Globe,
  Phone,
  Mail,
  MessageSquare,
  UserCheck,
  Sparkles,
  Smartphone,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  Business,
  Audit,
  AIReport,
  Contact,
  EvidenceRecord,
  Lead,
  LeadStatus,
} from '../types';
import { DraftEmailUtility } from './DraftEmailUtility';
import { OpportunityScoreTrendChart } from './OpportunityScoreTrendChart';

interface BusinessDetailModalProps {
  business: Business;
  audit?: Audit;
  audits?: Audit[];
  aiReport?: AIReport;
  contacts: Contact[];
  evidence: EvidenceRecord[];
  lead?: Lead;
  onClose: () => void;
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
  onSuppressBusiness: (businessId: string) => void;
  onDeleteBusiness: (businessId: string) => void;
}

export const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  audit,
  audits,
  aiReport,
  contacts,
  evidence,
  lead,
  onClose,
  onUpdateLead,
  onSuppressBusiness,
  onDeleteBusiness,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'contacts' | 'email' | 'crm'>('overview');
  const [selectedEmailRecipient, setSelectedEmailRecipient] = useState<string>('');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState(lead?.notes || '');
  const [followUpDate, setFollowUpDate] = useState(lead?.followUpDate || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const oppScore = audit?.opportunityScore ?? 0;
  const healthScore = audit?.websiteHealthScore ?? 0;
  const mobileScore = audit?.mobileScore ?? 0;
  const metrics = audit?.metrics;

  const handleSaveNotes = () => {
    if (!lead?.id) return;
    setIsSavingNotes(true);
    onUpdateLead(lead.id, {
      notes: notesText,
      followUpDate: followUpDate || undefined,
    });
    setTimeout(() => setIsSavingNotes(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">{business.name}</h2>
              <span className="rounded bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300 font-medium">
                {business.category}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span>{business.street ? `${business.street}, ` : ''}{business.city}, {business.country}</span>
              <span>&bull;</span>
              {business.websiteUrl ? (
                <a
                  href={business.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Globe className="h-3 w-3" />
                  {business.websiteUrl}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <span className="text-amber-400 font-medium">No Official Website</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Opportunity score badge with recharts sparkline */}
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 flex items-center gap-3">
              <div className="hidden sm:block">
                <OpportunityScoreTrendChart
                  currentScore={oppScore}
                  audits={audits}
                  businessCreatedAt={business.createdAt}
                  lastVerifiedAt={business.lastVerifiedAt}
                  variant="sparkline"
                />
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold tracking-wider text-purple-300">
                  Opportunity Score
                </div>
                <div className="text-xl font-black text-purple-200">
                  {oppScore} <span className="text-xs font-normal text-purple-300/70">/ 100</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 flex items-center gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI Proposal & Overview
          </button>
          <button
            onClick={() => setActiveTab('technical')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'technical'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Technical & Mobile Audit
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'contacts'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Verified Contacts & Evidence</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-300">
              {contacts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'email'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Draft Outreach Email</span>
          </button>
          <button
            onClick={() => setActiveTab('crm')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'crm'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Lead CRM & Actions
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 max-h-[68vh] overflow-y-auto space-y-6">
          {/* TAB 1: OVERVIEW & AI PROPOSAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Score Snapshot Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                  <div className="text-[11px] text-zinc-400">Website Health</div>
                  <div className={`text-lg font-bold mt-1 ${healthScore < 40 ? 'text-rose-400' : 'text-zinc-100'}`}>
                    {healthScore}/100
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                  <div className="text-[11px] text-zinc-400">Mobile Readability</div>
                  <div className={`text-lg font-bold mt-1 ${mobileScore < 50 ? 'text-rose-400' : 'text-zinc-100'}`}>
                    {mobileScore}/100
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                  <div className="text-[11px] text-zinc-400">Performance (LCP)</div>
                  <div className="text-lg font-bold mt-1 text-zinc-100">
                    {audit?.performanceScore ?? 0}/100
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                  <div className="text-[11px] text-zinc-400">Conversion Readiness</div>
                  <div className="text-lg font-bold mt-1 text-zinc-100">
                    {audit?.conversionScore ?? 0}/100
                  </div>
                </div>
              </div>

              {/* Historical Opportunity Score Trend Chart (recharts) */}
              <OpportunityScoreTrendChart
                currentScore={oppScore}
                audits={audits}
                businessCreatedAt={business.createdAt}
                lastVerifiedAt={business.lastVerifiedAt}
                variant="card"
                height={130}
              />

              {/* Gemini AI Executive Pitch */}
              {aiReport && (
                <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 via-zinc-900/80 to-zinc-900/80 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Gemini Intelligence Synthesis ({aiReport.model})
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">Executive Outreach Pitch</h3>
                    <p className="text-xs text-zinc-300 leading-relaxed italic bg-zinc-950/60 p-3.5 rounded-lg border border-indigo-500/20">
                      "{aiReport.executiveSummary}"
                    </p>
                  </div>

                  <div className="text-xs text-zinc-400 leading-relaxed">
                    {aiReport.summary}
                  </div>

                  {/* Detected Problems */}
                  {aiReport.problems && aiReport.problems.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-semibold text-zinc-200">Identified Vulnerabilities & Gaps</h4>
                      <div className="space-y-2">
                        {aiReport.problems.map((p, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg bg-zinc-950/80 p-2.5 border border-zinc-800 flex items-start gap-2.5 text-xs"
                          >
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0 ${
                                p.severity === 'high'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : p.severity === 'medium'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {p.severity}
                            </span>
                            <div>
                              <div className="font-medium text-zinc-200">{p.type}</div>
                              <div className="text-zinc-400 text-[11px] mt-0.5">{p.reason}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Services */}
                  {aiReport.recommendedServices && aiReport.recommendedServices.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-semibold text-zinc-200 mb-1.5">
                        High-Margin Agency Pitch Offerings
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {aiReport.recommendedServices.map((service, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-indigo-500/20 flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Ready to engage this lead?</span>
                    <button
                      onClick={() => setActiveTab('email')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Draft Outreach Email with this Pitch</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TECHNICAL & MOBILE AUDIT */}
          {activeTab === 'technical' && (
            <div className="space-y-6">
              {/* Section 37: Mobile Criteria Breakdown */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Deterministic Mobile Analysis (Total: {mobileScore}/100)
                    </h3>
                  </div>
                  <span className="text-xs text-zinc-400">Strict 7-Factor Standard</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-zinc-200">Viewport Meta Tag (20 pts)</div>
                      <div className="text-[11px] text-zinc-500">Essential for mobile scaling</div>
                    </div>
                    <span className={metrics?.viewportMeta ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {metrics?.viewportMeta ? '+20' : '0'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-zinc-200">Responsive Layout (20 pts)</div>
                      <div className="text-[11px] text-zinc-500">Fluid CSS media queries</div>
                    </div>
                    <span className={metrics?.responsiveLayout ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {metrics?.responsiveLayout ? '+20' : '0'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-zinc-200">No Horizontal Overflow (20 pts)</div>
                      <div className="text-[11px] text-zinc-500">No horizontal window scrolling</div>
                    </div>
                    <span className={!metrics?.horizontalOverflow ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {!metrics?.horizontalOverflow ? '+20' : '0'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-zinc-200">Text Readability (15 pts)</div>
                      <div className="text-[11px] text-zinc-500">Readable font scaling on small screens</div>
                    </div>
                    <span className="text-zinc-200 font-bold">
                      {Math.round(((metrics?.textReadabilityScore ?? 0) / 100) * 15)} / 15
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-zinc-200">Tap Targets (10 pts)</div>
                      <div className="text-[11px] text-zinc-500">Minimum 44px spacing between buttons</div>
                    </div>
                    <span className="text-zinc-200 font-bold">
                      {Math.round(((metrics?.tapTargetsScore ?? 0) / 100) * 10)} / 10
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-zinc-200">Mobile Navigation (5 pts)</div>
                      <div className="text-[11px] text-zinc-500">Mobile hamburger / app bar menu</div>
                    </div>
                    <span className="text-zinc-200 font-bold">
                      {Math.round(((metrics?.navigationScore ?? 0) / 100) * 5)} / 5
                    </span>
                  </div>
                </div>
              </div>

              {/* Core Web Vitals & Server Signals */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">Performance & Core Web Vitals</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <div className="text-zinc-400">LCP (Largest Paint)</div>
                    <div className="text-base font-bold text-zinc-100 mt-1">
                      {metrics?.lcp ? `${(metrics.lcp / 1000).toFixed(1)}s` : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <div className="text-zinc-400">FCP (First Paint)</div>
                    <div className="text-base font-bold text-zinc-100 mt-1">
                      {metrics?.fcp ? `${(metrics.fcp / 1000).toFixed(1)}s` : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <div className="text-zinc-400">CLS (Layout Shift)</div>
                    <div className="text-base font-bold text-zinc-100 mt-1">
                      {metrics?.cls ?? 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <div className="text-zinc-400">SSL Encryption</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {metrics?.sslValid ? 'Valid HTTPS' : 'Insecure HTTP'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTS & EVIDENCE (PROVENANCE) */}
          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-3 text-xs text-zinc-400 leading-relaxed">
                <span className="font-semibold text-zinc-200">Verifiable Contact Evidence:</span> Every contact point below is backed by public source URLs and cryptographic content verification to comply with agency outreach and GDPR standards.
              </div>

              {contacts.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  No public contact details could be reliably extracted from the website.
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => {
                    const relatedEvidence = evidence.filter((e) =>
                      e.fieldValue === contact.email ||
                      e.fieldValue === contact.phone ||
                      e.fieldValue === contact.whatsapp ||
                      e.fieldValue === contact.fullName
                    );
                    const isExpanded = expandedEvidenceId === contact.id;

                    return (
                      <div
                        key={contact.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
                              {contact.email ? (
                                <Mail className="h-4 w-4 text-emerald-400" />
                              ) : contact.phone ? (
                                <Phone className="h-4 w-4 text-indigo-400" />
                              ) : contact.whatsapp ? (
                                <MessageSquare className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-purple-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-zinc-100 text-xs sm:text-sm">
                                {contact.fullName || contact.email || contact.phone || contact.whatsapp}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {contact.jobTitle || contact.contactType} &bull; Verified Public Record
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {contact.whatsapp && (
                              <a
                                href={contact.whatsapp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-medium hover:bg-emerald-600 hover:text-white transition-colors"
                              >
                                <MessageSquare className="h-3 w-3" />
                                WhatsApp Chat
                              </a>
                            )}
                            {contact.email && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedEmailRecipient(contact.email || '');
                                    setActiveTab('email');
                                  }}
                                  className="inline-flex items-center gap-1 rounded bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-medium hover:bg-indigo-600 hover:text-white transition-colors"
                                >
                                  <Mail className="h-3 w-3" />
                                  Draft Email
                                </button>
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="inline-flex items-center gap-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-1 text-[11px] font-medium hover:bg-zinc-700 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Direct Mailto
                                </a>
                              </>
                            )}
                            <button
                              onClick={() => setExpandedEvidenceId(isExpanded ? null : contact.id)}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 ml-2"
                            >
                              Evidence Proof
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Evidence Drawer */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                            {relatedEvidence.map((ev) => (
                              <div key={ev.id} className="rounded-lg bg-zinc-950 p-3 border border-zinc-800 text-[11px] space-y-1.5">
                                <div className="flex items-center justify-between text-zinc-400">
                                  <span className="font-mono text-indigo-400">{ev.sourceType}</span>
                                  <span>Confidence: {Math.round(ev.confidence * 100)}%</span>
                                </div>
                                <div className="text-zinc-300 italic">
                                  "{ev.snippet}"
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                                  <span className="truncate max-w-xs">{ev.sourceUrl}</span>
                                  <span className="font-mono">Hash: {ev.contentHash}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: DRAFT OUTREACH EMAIL */}
          {activeTab === 'email' && (
            <DraftEmailUtility
              business={business}
              audit={audit}
              aiReport={aiReport}
              contacts={contacts}
              lead={lead}
              onUpdateLead={onUpdateLead}
              defaultRecipientEmail={selectedEmailRecipient}
            />
          )}

          {/* TAB 4: CRM LEAD MANAGEMENT & ACTIONS */}
          {activeTab === 'crm' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">Lead Qualification & Tracking</h3>

                {/* Status Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Pipeline Status
                    </label>
                    <select
                      value={lead?.status || 'NEW'}
                      onChange={(e) => {
                        if (lead?.id) {
                          onUpdateLead(lead.id, { status: e.target.value as LeadStatus });
                        }
                      }}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="NEW">New Prospect</option>
                      <option value="REVIEWING">Internal Review</option>
                      <option value="QUALIFIED">Qualified Opportunity</option>
                      <option value="CONTACTED">Outreach Sent</option>
                      <option value="REPLIED">Prospect Replied</option>
                      <option value="MEETING">Discovery Meeting Scheduled</option>
                      <option value="PROPOSAL">Proposal / Pitch Delivered</option>
                      <option value="WON">Deal Won (Customer)</option>
                      <option value="LOST">Lost</option>
                      <option value="DO_NOT_CONTACT">Suppressed / Do Not Contact</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Next Follow-Up Date
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Agency Notes & Pitch Customization
                  </label>
                  <textarea
                    rows={4}
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Add personalized talking points, client history, or meeting notes..."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveNotes}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                    >
                      {isSavingNotes ? 'Saved!' : 'Save CRM Notes'}
                    </button>
                  </div>
                </div>
              </div>

              {/* GDPR & Compliance Controls */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
                <div className="flex items-center gap-2 text-zinc-300">
                  <ShieldAlert className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold">Privacy & GDPR Suppression Controls</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Permanently suppress this business from agency cold outreach or purge collected public data in compliance with GDPR Right-to-be-Forgotten mandates.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => onSuppressBusiness(business.id)}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    Mark DO_NOT_CONTACT
                  </button>
                  <button
                    onClick={() => onDeleteBusiness(business.id)}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Purge All Business Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
