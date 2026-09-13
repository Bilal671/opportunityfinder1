import React, { useState, useEffect } from 'react';
import {
  Settings,
  Zap,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
} from 'lucide-react';
import { UsageQuota } from '../types';
import { apiFetch } from '../lib/api-client';

export const SettingsView: React.FC = () => {
  const [quota, setQuota] = useState<UsageQuota | null>(null);
  const [config, setConfig] = useState<{
    geminiConfigured: boolean;
    pageSpeedConfigured: boolean;
    googleMapsConfigured: boolean;
    apifyConfigured: boolean;
    turnstileConfigured: boolean;
    providers: Array<{ id: string; name: string; description: string; isConfigured: boolean }>;
  } | null>(null);

  const [apifyTokenInput, setApifyTokenInput] = useState('');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [tokenStatusMessage, setTokenStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = () => {
    apiFetch<{
      geminiConfigured: boolean;
      pageSpeedConfigured: boolean;
      googleMapsConfigured: boolean;
      apifyConfigured: boolean;
      turnstileConfigured: boolean;
      providers: Array<{ id: string; name: string; description: string; isConfigured: boolean }>;
    }>('/api/config')
      .then((data) => setConfig(data))
      .catch(() => {});
  };

  useEffect(() => {
    apiFetch<{ quota: UsageQuota }>('/api/quota')
      .then((data) => setQuota(data.quota))
      .catch(() => {});

    fetchConfig();
  }, []);

  const handleSaveApifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apifyTokenInput.trim()) {
      setTokenStatusMessage({ type: 'error', text: 'Please enter an Apify API Token.' });
      return;
    }

    setIsSavingToken(true);
    setTokenStatusMessage(null);

    try {
      await apiFetch<{ success: boolean; message: string }>('/api/config/apify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apifyTokenInput.trim() }),
      });

      setTokenStatusMessage({ type: 'success', text: 'Apify API Token configured successfully! Live Google Maps scraping is active.' });
      setApifyTokenInput('');
      fetchConfig();
    } catch (err: unknown) {
      setTokenStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save token.',
      });
    } finally {
      setIsSavingToken(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-indigo-400" />
          Workspace Quotas & Provider Status
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Monitor search quotas, plan allowances, and external provider integration connectivity.
        </p>
      </div>

      {/* Quotas & Usage Card */}
      {quota && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Monthly Plan Quota & Usage</h2>
            </div>
            <span className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              {quota.plan} PLAN
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Searches */}
            <div className="space-y-2 p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">Discovery Searches</span>
                <span className="text-zinc-400">
                  {quota.searchesCount} / {quota.maxSearches}
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${(quota.searchesCount / quota.maxSearches) * 100}%` }}
                />
              </div>
            </div>

            {/* Audits */}
            <div className="space-y-2 p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">Deep Audits Performed</span>
                <span className="text-zinc-400">
                  {quota.auditsCount} / {quota.maxAudits}
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(quota.auditsCount / quota.maxAudits) * 100}%` }}
                />
              </div>
            </div>

            {/* AI Syntheses */}
            <div className="space-y-2 p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">Gemini AI Reports</span>
                <span className="text-zinc-400">
                  {quota.aiAnalysesCount} / {quota.maxAiAnalyses}
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(quota.aiAnalysesCount / quota.maxAiAnalyses) * 100}%` }}
                />
              </div>
            </div>

            {/* Exports */}
            <div className="space-y-2 p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">Safe CSV Exports</span>
                <span className="text-zinc-400">
                  {quota.exportsCount} / {quota.maxExports}
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${(quota.exportsCount / quota.maxExports) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provider Connectivity Status */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Database className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Discovery Provider Registry</h2>
        </div>

        <div className="space-y-2.5">
          {config?.providers.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-semibold text-zinc-200">{p.name}</div>
                <div className="text-[11px] text-zinc-400">{p.description}</div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] font-medium ${
                  p.isConfigured
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {p.isConfigured ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Available
                  </>
                ) : (
                  'Key Needed'
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Integration & Environment Variables Guide */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <KeyRound className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Environment Configuration Status</h2>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-zinc-200">Google Gemini AI SDK (@google/genai)</div>
              <div className="text-[11px] text-zinc-500">Powers prompt-injection safe website opportunity analysis</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${config?.geminiConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {config?.geminiConfigured ? 'Connected' : 'Fallback Engine Active'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-zinc-200">Google PageSpeed Insights API</div>
              <div className="text-[11px] text-zinc-500">Official Google mobile performance and Core Web Vitals scoring</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${config?.pageSpeedConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
              {config?.pageSpeedConfigured ? 'Connected' : 'Crawler Timing Mode'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-zinc-200">Apify Google Maps Scraper (Actor API)</div>
              <div className="text-[11px] text-zinc-500">Live scraping of genuine Google Maps places, phones, and websites</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${config?.apifyConfigured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
              {config?.apifyConfigured ? 'Connected (Live Scraping)' : 'Token Needed'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-zinc-200">Google Places API (Web Services)</div>
              <div className="text-[11px] text-zinc-500">Optional official Google Cloud Places API query</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${config?.googleMapsConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
              {config?.googleMapsConfigured ? 'Connected' : 'Not Configured'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-zinc-200">Cloudflare Turnstile CAPTCHA</div>
              <div className="text-[11px] text-zinc-500">Anti-bot security verification (skipped for now; pass-through active)</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
              {config?.turnstileConfigured ? 'Connected' : 'Skipped for now (Bypassed)'}
            </span>
          </div>
        </div>

        {/* Apify In-App Token Configuration Card */}
        <div className="rounded-lg bg-zinc-950 border border-indigo-500/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-semibold text-white">Configure Apify API Token</h3>
            </div>
            {config?.apifyConfigured && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Enter your personal Apify API Token below to enable genuine Google Maps lead scraping immediately without restarting or editing Vercel variables. You can find your token at <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Apify Console &gt; Integrations</a>.
          </p>

          <form onSubmit={handleSaveApifyToken} className="flex gap-2">
            <input
              type="password"
              placeholder={config?.apifyConfigured ? 'Token configured (enter new token to update)' : 'apify_api_...'}
              value={apifyTokenInput}
              onChange={(e) => setApifyTokenInput(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={isSavingToken}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shrink-0"
            >
              {isSavingToken ? 'Saving...' : 'Save Token'}
            </button>
          </form>

          {tokenStatusMessage && (
            <div
              className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                tokenStatusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {tokenStatusMessage.type === 'success' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{tokenStatusMessage.text}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-[11px] text-zinc-400 leading-relaxed">
          <span className="font-semibold text-zinc-200">Vercel Environment Note:</span> You can also permanently set <code>APIFY_API_TOKEN</code> in your Vercel Project Settings &gt; Environment Variables.
        </div>
      </div>
    </div>
  );
};
