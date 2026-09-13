import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  FileCode,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { SecurityEvent } from '../types';
import { apiFetch } from '../lib/api-client';

export const SecuritySuiteView: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<{
    timestamp: string;
    allPassed: boolean;
    results: Array<{ testName: string; passed: boolean; details: string }>;
  } | null>(null);

  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const loadEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const data = await apiFetch<{ events: SecurityEvent[] }>('/api/security/events');
      setSecurityEvents(data.events || []);
    } catch {
      // Ignore
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const runSecurityTests = async () => {
    setIsRunning(true);
    try {
      const data = await apiFetch('/api/security/run-tests', { method: 'POST' });
      setTestResults(data);
    } catch (err: unknown) {
      console.error('Failed to run security tests:', err);
    } finally {
      setIsRunning(false);
      loadEvents();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            Security & Penetration Test Suite
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automated verification of SSRF defenses, Cloud Metadata blocking, CSV injection escaping, and RLS multi-tenant isolation.
          </p>
        </div>

        <button
          onClick={runSecurityTests}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running Live Pen Tests...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Security Test Suite
            </>
          )}
        </button>
      </div>

      {/* Test Results Card */}
      {testResults && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              {testResults.allPassed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-400" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {testResults.allPassed
                    ? 'All Penetration Tests Passed (100% Secure)'
                    : 'Vulnerabilities Flagged in Test Run'}
                </h3>
                <p className="text-xs text-zinc-400">
                  Executed at {new Date(testResults.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                testResults.allPassed
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {testResults.results.filter((r) => r.passed).length} / {testResults.results.length} Passed
            </span>
          </div>

          <div className="space-y-2.5">
            {testResults.results.map((res, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-zinc-200">{res.testName}</div>
                  <div className="text-[11px] text-zinc-400 font-mono">{res.details}</div>
                </div>

                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    res.passed
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {res.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Architecture Specifications (Production Hardening) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
            <Lock className="h-4 w-4" />
            SSRF Network Shield
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Crawler resolves hostnames via DNS lookup and rigorously verifies resolved IPs before HTTP execution. Cloud metadata IP <code>169.254.169.254</code> and RFC1918 private subnets are permanently blocked.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
            <FileCode className="h-4 w-4" />
            CSV Formula Sanitization
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All spreadsheet exports dynamically escape leading formula trigger characters (<code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>, tab) by prefixing apostrophes to prevent Excel/Sheets formula execution.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
            <Terminal className="h-4 w-4" />
            Prompt Injection Guard
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Gemini system instructions isolate public crawled text as untrusted raw evidence, instructing the model to reject directive overrides and enforcing strict Zod schema validation on structured outputs.
          </p>
        </div>
      </div>

      {/* Security Audit Event Log */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Security Event Log</h3>
            <p className="text-xs text-zinc-400">Auditable tamper-evident security telemetry</p>
          </div>
          <button
            onClick={loadEvents}
            disabled={isLoadingEvents}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingEvents ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="text-[11px] font-medium text-zinc-500 uppercase border-b border-zinc-800/80">
              <tr>
                <th className="py-2">Event Type</th>
                <th className="py-2">Hashed Client IP</th>
                <th className="py-2">Details</th>
                <th className="py-2 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {securityEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-zinc-500">
                    No security violations or rate limit events recorded yet.
                  </td>
                </tr>
              ) : (
                securityEvents.slice(0, 15).map((evt) => (
                  <tr key={evt.id} className="hover:bg-zinc-800/20">
                    <td className="py-2.5 font-mono text-[11px] text-amber-400">
                      {evt.type}
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-zinc-400">
                      {evt.hashedIp}
                    </td>
                    <td className="py-2.5 text-zinc-300 max-w-xs truncate">
                      {JSON.stringify(evt.details)}
                    </td>
                    <td className="py-2.5 text-right text-[11px] text-zinc-500">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
