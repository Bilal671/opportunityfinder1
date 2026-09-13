import React from 'react';
import {
  TrendingUp,
  Globe,
  AlertTriangle,
  Smartphone,
  Gauge,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Business, Audit, Lead } from '../types';

interface DashboardViewProps {
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
  onSelectBusiness: (businessId: string) => void;
  onNavigateToSearch: () => void;
  onNavigateToLeads: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  businesses,
  onSelectBusiness,
  onNavigateToSearch,
  onNavigateToLeads,
}) => {
  const totalBusinesses = businesses.length;
  const highOpportunities = businesses.filter((b) => (b.audit?.opportunityScore ?? 0) >= 75);
  const noWebsiteBusinesses = businesses.filter((b) => b.websiteStatus === 'NO_WEBSITE');
  const slowWebsites = businesses.filter((b) => (b.audit?.performanceScore ?? 100) < 45 && b.websiteStatus !== 'NO_WEBSITE');
  const mobileIssues = businesses.filter((b) => (b.audit?.mobileScore ?? 100) < 50 && b.websiteStatus !== 'NO_WEBSITE');

  // Distribution
  const veryHigh = businesses.filter((b) => (b.audit?.opportunityScore ?? 0) >= 90).length;
  const high = businesses.filter((b) => (b.audit?.opportunityScore ?? 0) >= 75 && (b.audit?.opportunityScore ?? 0) < 90).length;
  const good = businesses.filter((b) => (b.audit?.opportunityScore ?? 0) >= 60 && (b.audit?.opportunityScore ?? 0) < 75).length;
  const medium = businesses.filter((b) => (b.audit?.opportunityScore ?? 0) >= 40 && (b.audit?.opportunityScore ?? 0) < 60).length;
  const low = businesses.filter((b) => (b.audit?.opportunityScore ?? 0) < 40).length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/70 to-indigo-950/40 p-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
            <TrendingUp className="h-3.5 w-3.5" />
            AI Opportunity Discovery Active
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Local Business Opportunity Dashboard
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            AI-powered scanning identifies local companies with weak or missing websites, audits their mobile performance, extracts verified public decision-makers, and calculates high-margin agency opportunities.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateToSearch}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              Start New Discovery Scan
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onNavigateToLeads}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              View All Discovered Leads ({totalBusinesses})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Businesses Scanned</span>
            <Globe className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">{totalBusinesses}</span>
            <span className="text-xs text-emerald-400 flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Across verified licensed & open registries</p>
        </div>

        {/* Card 2 */}
        <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4">
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-xs font-medium">High Opportunities</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-indigo-200">{highOpportunities.length}</span>
            <span className="text-xs text-indigo-400 font-medium">Score &ge; 75</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">Strongest commercial agency prospects</p>
        </div>

        {/* Card 3 */}
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-4">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-medium">No Website Found</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-amber-200">{noWebsiteBusinesses.length}</span>
            <span className="text-xs text-amber-400/90 font-medium">Turnkey Web Dev</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">Active businesses without online presence</p>
        </div>

        {/* Card 4 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Mobile Deficits</span>
            <Smartphone className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">{mobileIssues.length}</span>
            <span className="text-xs text-rose-400 font-medium">Score &lt; 50</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Missing viewport or layout overflow</p>
        </div>
      </div>

      {/* Two Column Layout: Opportunity Distribution + Recent High Value Prospects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Distribution Breakdown */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Opportunity Score Distribution</h2>
              <p className="text-xs text-zinc-400">Commercial prospect strength tiers</p>
            </div>
            <Gauge className="h-4 w-4 text-zinc-400" />
          </div>

          <div className="space-y-3 pt-1">
            {/* Very High 90-100 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-purple-300 font-medium">Very High (90 - 100)</span>
                <span className="text-zinc-300 font-semibold">{veryHigh}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalBusinesses ? (veryHigh / totalBusinesses) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* High 75-89 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-indigo-300 font-medium">High (75 - 89)</span>
                <span className="text-zinc-300 font-semibold">{high}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalBusinesses ? (high / totalBusinesses) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Good 60-74 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-300 font-medium">Good (60 - 74)</span>
                <span className="text-zinc-300 font-semibold">{good}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalBusinesses ? (good / totalBusinesses) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Medium 40-59 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-300 font-medium">Medium (40 - 59)</span>
                <span className="text-zinc-300 font-semibold">{medium}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalBusinesses ? (medium / totalBusinesses) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Low 0-39 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 font-medium">Low (0 - 39)</span>
                <span className="text-zinc-400 font-semibold">{low}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-600 rounded-full transition-all duration-500"
                  style={{ width: `${totalBusinesses ? (low / totalBusinesses) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-950/60 p-3 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
            <span className="font-semibold text-zinc-200">How Opportunity Score is calculated:</span> Combines Mobile deficit (20%), PageSpeed need (20%), Conversion weakness (20%), Design weakness (15%), SEO need (10%), and Industry Commercial Potential (15%).
          </div>
        </div>

        {/* Right: Top Opportunity Highlights */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Priority Local Opportunities</h2>
              <p className="text-xs text-zinc-400">High-conviction businesses with technical weaknesses</p>
            </div>
            <button
              onClick={onNavigateToLeads}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Full Table <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {highOpportunities.slice(0, 4).map((b) => {
              const oppScore = b.audit?.opportunityScore ?? 0;
              const healthScore = b.audit?.websiteHealthScore ?? 0;

              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBusiness(b.id)}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group cursor-pointer hover:bg-zinc-800/30 px-2 rounded-lg transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100 text-sm group-hover:text-indigo-400 transition-colors">
                        {b.name}
                      </span>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        {b.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>{b.city}, {b.country}</span>
                      <span>&bull;</span>
                      <span className={b.websiteStatus === 'NO_WEBSITE' ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
                        {b.websiteStatus === 'NO_WEBSITE' ? 'No Website' : b.websiteUrl ? new URL(b.websiteUrl).hostname : 'Website found'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-[11px] text-zinc-400">Opportunity</div>
                      <div className="text-sm font-semibold text-purple-400">{oppScore}/100</div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-zinc-400">Health</div>
                      <div className={`text-sm font-semibold ${healthScore < 40 ? 'text-rose-400' : 'text-zinc-300'}`}>
                        {healthScore}/100
                      </div>
                    </div>

                    <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
