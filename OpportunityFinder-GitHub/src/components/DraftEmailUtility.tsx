import React, { useState, useMemo } from 'react';
import {
  Mail,
  Copy,
  Check,
  Send,
  Sparkles,
  Sliders,
  Variable,
  FileText,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Business, Audit, AIReport, Contact, Lead } from '../types';

interface DraftEmailUtilityProps {
  business: Business;
  audit?: Audit;
  aiReport?: AIReport;
  contacts: Contact[];
  lead?: Lead;
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
  defaultRecipientEmail?: string;
}

type TemplateId = 'mobile_audit' | 'no_website' | 'speed_seo' | 'ai_synthesis' | 'custom';
type EmailTone = 'consultative' | 'direct' | 'friendly' | 'urgent';

interface EmailTemplate {
  id: TemplateId;
  name: string;
  description: string;
  subject: string;
  body: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'mobile_audit',
    name: 'Mobile & UX Modernization',
    description: 'Highlights mobile responsiveness and user experience bottlenecks.',
    subject: "Quick observation regarding {business_name}'s mobile website in {city}",
    body: `Hi {contact_name},

I was recently looking into leading {category} businesses in {city} and came across {business_name}.

While running a digital presence audit for local services, our tools flagged a few key mobile display and responsiveness bottlenecks on your website (Mobile Readiness Score: {mobile_score}/100):
- Primary concern: {primary_issue}
- Opportunity Score: {opportunity_score}/100 (high potential for client conversion uplift)

With over 70% of local customers searching on their smartphones, fixing these issues directly impacts the number of inbound calls and inquiries you receive.

We specialize in modern, high-converting digital experiences for {category} firms. Would you be open to a brief 5-minute review this Thursday to walk through the free diagnostic breakdown?

Best regards,

{sender_name}
{sender_company}`,
  },
  {
    id: 'no_website',
    name: 'New Digital Presence',
    description: 'Tailored for businesses with no official website or broken URLs.',
    subject: 'High-margin client acquisition opportunity for {business_name} in {city}',
    body: `Hi {contact_name},

I was researching top-rated {category} providers in {city} and noticed {business_name} currently does not have an active official website for local searchers.

Every month, hundreds of people in {city} search Google for {category} services. Without a verified, mobile-optimized site, those prospective customers typically end up calling competing providers nearby.

Our team at {sender_company} builds turnkey, lightning-fast web presences specifically tailored for {category} businesses that establish credibility and turn searchers into paying clients.

Would you be open to seeing a complimentary design mockup of what a modern web presence for {business_name} could look like?

Warm regards,

{sender_name}
{sender_company}`,
  },
  {
    id: 'speed_seo',
    name: 'Speed & Core Web Vitals',
    description: 'Data-driven pitch focusing on site performance and Google search visibility.',
    subject: 'Site speed & search ranking audit: {business_name}',
    body: `Hi {contact_name},

I hope this message finds you well. I recently ran a technical speed and Core Web Vitals audit on {website_url}.

Your site is currently registering an opportunity score of {opportunity_score}/100. In particular, our scan identified:
- Key issue: {primary_issue}
- Slower-than-recommended load times for mobile searchers

Google now heavily prioritizes fast, responsive sites in local search results. We help local {category} businesses cut load times by over 50% and implement structured data to rank higher on Google Maps.

Let me know if you'd like me to email over our complete 1-page performance PDF for {business_name}.

Best,

{sender_name}
{sender_company}`,
  },
  {
    id: 'ai_synthesis',
    name: 'Executive AI Strategy Pitch',
    description: 'Leverages Gemini executive analysis and recommended high-margin services.',
    subject: 'Growth & digital strategy audit for {business_name}',
    body: `Hi {contact_name},

I conducted a strategic digital review for {business_name} ({category} in {city}) and wanted to share our key findings with leadership:

"{ai_summary}"

Based on your current setup, we identified high-impact opportunities in:
{recommended_services}

We work with select {category} leaders to modernize their web presence, accelerate inquiry capture, and protect their local market leadership.

Do you have 10 minutes next Tuesday or Wednesday for a quick introductory discussion?

Sincerely,

{sender_name}
{sender_company}`,
  },
  {
    id: 'custom',
    name: 'Custom / Scratch Template',
    description: 'Start with a clean slate and insert any variables freely.',
    subject: 'Question for {business_name}',
    body: `Hi {contact_name},

I am reaching out regarding {business_name} in {city}.

[Insert your custom pitch here]

Best,
{sender_name}
{sender_company}`,
  },
];

export const DraftEmailUtility: React.FC<DraftEmailUtilityProps> = ({
  business,
  audit,
  aiReport,
  contacts,
  lead,
  onUpdateLead,
  defaultRecipientEmail,
}) => {
  // Determine best initial template based on business condition
  const initialTemplateId: TemplateId =
    business.websiteStatus === 'NO_WEBSITE'
      ? 'no_website'
      : aiReport
      ? 'ai_synthesis'
      : 'mobile_audit';

  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>(initialTemplateId);
  const [tone, setTone] = useState<EmailTone>('consultative');
  const [senderName, setSenderName] = useState<string>('Alex Morgan');
  const [senderCompany, setSenderCompany] = useState<string>('Apex Digital Growth');

  // Recipient selection
  const verifiedEmails = useMemo(() => {
    const emails: string[] = [];
    contacts.forEach((c) => {
      if (c.email && !emails.includes(c.email)) {
        emails.push(c.email);
      }
    });
    return emails;
  }, [contacts]);

  const [recipientEmail, setRecipientEmail] = useState<string>(
    defaultRecipientEmail || (verifiedEmails.length > 0 ? verifiedEmails[0] : '')
  );

  // Editable subject and template body
  const currentTemplate = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId) || EMAIL_TEMPLATES[0];
  const [subjectTemplate, setSubjectTemplate] = useState<string>(currentTemplate.subject);
  const [bodyTemplate, setBodyTemplate] = useState<string>(currentTemplate.body);
  const [viewMode, setViewMode] = useState<'preview' | 'template'>('preview');

  // Copy status state
  const [copied, setCopied] = useState(false);
  const [loggedOutreach, setLoggedOutreach] = useState(false);

  // When switching template, reset subject and body
  const handleSelectTemplate = (id: TemplateId) => {
    setSelectedTemplateId(id);
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === id);
    if (tmpl) {
      setSubjectTemplate(tmpl.subject);
      setBodyTemplate(tmpl.body);
    }
  };

  // Derive evaluated variable dictionary
  const variableDict: Record<string, string> = useMemo(() => {
    const oppScore = audit?.opportunityScore ?? 75;
    const mobScore = audit?.mobileScore ?? 45;
    const hlthScore = audit?.websiteHealthScore ?? 50;

    let primaryIssue = 'mobile viewport scaling and responsiveness';
    if (business.websiteStatus === 'NO_WEBSITE') {
      primaryIssue = 'lack of an official verified web presence';
    } else if (business.websiteStatus === 'WEBSITE_DOWN') {
      primaryIssue = 'server downtime and unreachable website address';
    } else if (audit?.metrics?.horizontalOverflow) {
      primaryIssue = 'horizontal layout overflow and clipped mobile content';
    } else if (audit?.metrics?.lcp && audit.metrics.lcp > 4000) {
      primaryIssue = `slow mobile paint times (${(audit.metrics.lcp / 1000).toFixed(1)}s LCP)`;
    } else if (aiReport?.problems && aiReport.problems.length > 0) {
      primaryIssue = `${aiReport.problems[0].type}: ${aiReport.problems[0].reason}`;
    }

    const recServices =
      aiReport?.recommendedServices && aiReport.recommendedServices.length > 0
        ? aiReport.recommendedServices.map((s) => `• ${s}`).join('\n')
        : '• Mobile UX & Web Redesign\n• Core Web Vitals Performance Optimization\n• Local Search & SEO Architecture';

    // Decision maker contact name
    const decisionMaker = contacts.find((c) => c.isDecisionMaker && c.name);
    const contactName = decisionMaker?.name || contacts[0]?.name || 'Owner / Leadership Team';

    const aiSummary =
      aiReport?.executiveSummary ||
      `Digital analysis indicates significant customer acquisition opportunity for ${business.name} in ${business.city} through modern mobile optimization and performance tuning.`;

    return {
      '{business_name}': business.name,
      '{category}': business.category,
      '{city}': business.city,
      '{country}': business.country,
      '{contact_name}': contactName,
      '{website_url}': business.websiteUrl || 'your business profile',
      '{mobile_score}': `${mobScore}`,
      '{opportunity_score}': `${oppScore}`,
      '{health_score}': `${hlthScore}`,
      '{primary_issue}': primaryIssue,
      '{recommended_services}': recServices,
      '{ai_summary}': aiSummary,
      '{sender_name}': senderName,
      '{sender_company}': senderCompany,
    };
  }, [business, audit, aiReport, contacts, senderName, senderCompany]);

  // Interpolation function
  const interpolate = (text: string): string => {
    let result = text;
    Object.entries(variableDict).forEach(([placeholder, value]) => {
      // Global replacement of placeholder
      result = result.split(placeholder).join(value);
    });

    // Tone modifiers adjustments
    if (tone === 'direct') {
      result = result.replace('Would you be open to a brief 5-minute review', 'Are you free for 5 minutes');
      result = result.replace('I hope this message finds you well. ', '');
    } else if (tone === 'friendly') {
      result = result.replace('Hi {contact_name},', `Hi ${variableDict['{contact_name}']},\n\nHope you're having a great week!`);
    } else if (tone === 'urgent') {
      result = result.replace('best regards,', 'looking forward to hearing from you promptly,');
    }

    return result;
  };

  const evaluatedSubject = useMemo(() => interpolate(subjectTemplate), [subjectTemplate, variableDict, tone]);
  const evaluatedBody = useMemo(() => interpolate(bodyTemplate), [bodyTemplate, variableDict, tone]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      const fullText = `Subject: ${evaluatedSubject}\n\n${evaluatedBody}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Generate mailto link
  const mailtoUrl = useMemo(() => {
    const encodedSubject = encodeURIComponent(evaluatedSubject);
    const encodedBody = encodeURIComponent(evaluatedBody);
    const to = recipientEmail ? encodeURIComponent(recipientEmail) : '';
    return `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
  }, [recipientEmail, evaluatedSubject, evaluatedBody]);

  // Mark as Contacted / Log Outreach in CRM
  const handleLogOutreach = () => {
    if (!lead?.id || !onUpdateLead) return;
    const now = new Date();
    const logEntry = `\n[${now.toLocaleDateString()} ${now.toLocaleTimeString()}] Cold outreach drafted & sent via email (Subject: "${evaluatedSubject}") to ${recipientEmail || 'Prospect'}.`;
    const updatedNotes = (lead.notes || '') + logEntry;

    onUpdateLead(lead.id, {
      status: 'CONTACTED',
      notes: updatedNotes,
    });
    setLoggedOutreach(true);
    setTimeout(() => setLoggedOutreach(false), 3000);
  };

  // Quick insert variable into current body template
  const handleInsertVariable = (varKey: string) => {
    setBodyTemplate((prev) => `${prev} ${varKey}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Template Picker */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Outreach Email Generator</h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Generate data-backed agency pitch emails using live template variables from {business.name}.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'preview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Rendered Preview
            </button>
            <button
              onClick={() => setViewMode('template')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'template'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Edit Template
            </button>
          </div>
        </div>

        {/* Template Selection Chips */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Select Outreach Strategy
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {EMAIL_TEMPLATES.map((tmpl) => {
              const isSelected = selectedTemplateId === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={`text-left p-2.5 rounded-lg border transition-all text-xs ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/40 text-white ring-1 ring-indigo-500/50'
                      : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>{tmpl.name}</span>
                    {isSelected && <CheckCircle2 className="h-3 w-3 text-indigo-400" />}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1 line-clamp-1">{tmpl.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Configuration Row: Recipient, Tone, Sender */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Recipient */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-1.5">
          <label className="block text-[11px] font-semibold text-zinc-300">
            Recipient Contact
          </label>
          {verifiedEmails.length > 0 ? (
            <select
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {verifiedEmails.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
              <option value="">Custom Manual Email</option>
            </select>
          ) : (
            <input
              type="email"
              placeholder="e.g. info@business.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          )}
          <span className="text-[10px] text-zinc-500">
            {verifiedEmails.length > 0 ? 'Verified statutory or public inbox' : 'No email detected in audit; enter manually'}
          </span>
        </div>

        {/* Tone Selector */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-1.5">
          <label className="block text-[11px] font-semibold text-zinc-300">
            Pitch Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as EmailTone)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="consultative">Consultative & Helpful</option>
            <option value="direct">Direct & Problem-Focused</option>
            <option value="friendly">Warm & Relationship-Driven</option>
            <option value="urgent">Urgent & Metric-Focused</option>
          </select>
          <span className="text-[10px] text-zinc-500">Dynamically tweaks greetings and call-to-actions</span>
        </div>

        {/* Sender Identity */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-1.5">
          <label className="block text-[11px] font-semibold text-zinc-300">
            Sender & Agency Branding
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              placeholder="Your Name"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Agency Name"
              value={senderCompany}
              onChange={(e) => setSenderCompany(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <span className="text-[10px] text-zinc-500">Interpolates {`{sender_name}`} and {`{sender_company}`}</span>
        </div>
      </div>

      {/* Available Template Variables Chip Tray */}
      <div className="rounded-xl border border-zinc-800/90 bg-zinc-950 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <Variable className="h-3.5 w-3.5 text-indigo-400" />
            <span>Dynamic Template Variables for {business.name}</span>
          </div>
          <span className="text-[11px] text-zinc-500">Click any chip to append into template</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(variableDict).map(([placeholder, evaluatedVal]) => (
            <button
              key={placeholder}
              onClick={() => handleInsertVariable(placeholder)}
              title={`Evaluates to: "${evaluatedVal}"`}
              className="group inline-flex items-center gap-1 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-1 text-[11px] font-mono text-zinc-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
            >
              <span>{placeholder}</span>
              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 font-sans max-w-[120px] truncate">
                ({evaluatedVal.replace(/\n/g, ', ')})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Email Draft Box */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
        {/* Subject Line Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-zinc-200">Subject Line</label>
            <span className="text-[11px] text-zinc-500">
              {viewMode === 'preview' ? 'Rendered Subject' : 'Template with Variables'}
            </span>
          </div>
          {viewMode === 'preview' ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs font-medium text-white select-all">
              {evaluatedSubject}
            </div>
          ) : (
            <input
              type="text"
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          )}
        </div>

        {/* Email Body Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-zinc-200">Email Message Body</label>
            <span className="text-[11px] text-zinc-500">
              {viewMode === 'preview' ? 'Live Evaluated Output' : 'Editable Template Text'}
            </span>
          </div>

          {viewMode === 'preview' ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed select-all font-sans min-h-[220px]">
              {evaluatedBody}
            </div>
          ) : (
            <textarea
              rows={11}
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-xs text-zinc-200 font-mono leading-relaxed focus:border-indigo-500 focus:outline-none"
            />
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Opportunity Score:</span>
            <span className="font-bold text-indigo-400">
              {audit?.opportunityScore ?? 75}/100
            </span>
            <span>&bull;</span>
            <span>Category:</span>
            <span className="text-zinc-200">{business.category}</span>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
            {/* Copy to Clipboard */}
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Draft</span>
                </>
              )}
            </button>

            {/* Launch Native Email Client (mailto:) */}
            <a
              href={mailtoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Open in Mail Client</span>
            </a>

            {/* Mark as Contacted in CRM */}
            {lead && onUpdateLead && (
              <button
                onClick={handleLogOutreach}
                disabled={loggedOutreach}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  loggedOutreach
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white'
                }`}
              >
                {loggedOutreach ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Logged to CRM!</span>
                  </>
                ) : (
                  <span>Log as Contacted</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
