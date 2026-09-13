import crypto from 'node:crypto';
import { Contact, EvidenceRecord } from '../../types';
import { CrawledPage } from './crawler';

export interface ExtractedContactResult {
  contacts: Contact[];
  evidence: EvidenceRecord[];
}

/**
 * Extracts public contact points and leadership from crawled pages with traceable evidence.
 */
export function extractContactsAndEvidence(
  businessId: string,
  pages: CrawledPage[]
): ExtractedContactResult {
  const contacts: Contact[] = [];
  const evidence: EvidenceRecord[] = [];

  const foundEmails = new Set<string>();
  const foundPhones = new Set<string>();
  const foundWhatsApps = new Set<string>();

  for (const page of pages) {
    const text = page.bodyText;
    const html = page.rawHtml;

    // 1. Email Extraction
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,6})/g;
    const emailMatches = text.match(emailRegex) || [];

    for (const email of emailMatches) {
      const cleanEmail = email.toLowerCase().trim();
      // Ignore common asset extensions or spam traps
      if (cleanEmail.endsWith('.png') || cleanEmail.endsWith('.jpg') || cleanEmail.endsWith('.svg') || cleanEmail.includes('sentry')) {
        continue;
      }

      if (!foundEmails.has(cleanEmail)) {
        foundEmails.add(cleanEmail);
        const isGeneric = cleanEmail.startsWith('info@') || cleanEmail.startsWith('kontakt@') || cleanEmail.startsWith('contact@') || cleanEmail.startsWith('mail@');

        const contactId = `con_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        contacts.push({
          id: contactId,
          businessId,
          email: cleanEmail,
          emailType: isGeneric ? 'generic' : 'personal',
          contactType: isGeneric ? 'generic' : 'employee',
          publiclyListed: true,
          verified: true,
          confidence: 0.95,
          sourceUrl: page.url,
          sourceType: page.url.includes('impressum') ? 'impressum' : 'website-contact',
          collectedAt: new Date().toISOString(),
        });

        evidence.push({
          id: `ev_em_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          businessId,
          fieldName: 'email',
          fieldValue: cleanEmail,
          sourceUrl: page.url,
          sourceType: 'business-page',
          confidence: 0.95,
          collectedAt: new Date().toISOString(),
          contentHash: crypto.createHash('sha256').update(cleanEmail).digest('hex').substring(0, 16),
          snippet: `Publicly listed on page: ${page.url}`,
        });
      }
    }

    // 2. Phone Extraction (German & international formats)
    const phoneRegex = /(?:\+49|0049|0)[1-9][0-9 \-/()]{6,16}[0-9]/g;
    const phoneMatches = text.match(phoneRegex) || [];

    for (const rawPhone of phoneMatches) {
      const cleanPhone = rawPhone.replace(/\s+/g, ' ').trim();
      if (cleanPhone.length >= 8 && !foundPhones.has(cleanPhone)) {
        foundPhones.add(cleanPhone);
        contacts.push({
          id: `con_ph_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          businessId,
          phone: cleanPhone,
          contactType: 'business',
          publiclyListed: true,
          verified: true,
          confidence: 0.92,
          sourceUrl: page.url,
          sourceType: 'website-phone',
          collectedAt: new Date().toISOString(),
        });

        evidence.push({
          id: `ev_ph_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          businessId,
          fieldName: 'phone',
          fieldValue: cleanPhone,
          sourceUrl: page.url,
          sourceType: 'business-page',
          confidence: 0.92,
          collectedAt: new Date().toISOString(),
          contentHash: crypto.createHash('sha256').update(cleanPhone).digest('hex').substring(0, 16),
          snippet: `Telephone contact on ${page.url}`,
        });
      }
    }

    // 3. WhatsApp detection (wa.me or api.whatsapp.com)
    const waRegex = /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com\/send)\b[^\s"'<>]+/gi;
    const waMatches = html.match(waRegex) || [];

    for (const waLink of waMatches) {
      if (!foundWhatsApps.has(waLink)) {
        foundWhatsApps.add(waLink);
        contacts.push({
          id: `con_wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          businessId,
          whatsapp: waLink,
          contactType: 'business',
          publiclyListed: true,
          verified: true,
          confidence: 0.98,
          sourceUrl: page.url,
          sourceType: 'whatsapp-direct-link',
          collectedAt: new Date().toISOString(),
        });

        evidence.push({
          id: `ev_wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          businessId,
          fieldName: 'whatsapp_chat',
          fieldValue: waLink,
          sourceUrl: page.url,
          sourceType: 'html-anchor-tag',
          confidence: 0.98,
          collectedAt: new Date().toISOString(),
          contentHash: crypto.createHash('sha256').update(waLink).digest('hex').substring(0, 16),
          snippet: `Direct WhatsApp click-to-chat action link found on page.`,
        });
      }
    }

    // 4. Decision-Maker / Leadership Extraction (Conservative)
    // Matches patterns like: "Geschäftsführer: John Doe", "Inhaber: Jane Smith", "Managing Director: ..."
    const directorRegex = /(?:Geschäftsführer|Inhaber|Managing Director|Vorstand|Owner|Principal)\s*[:\-–]\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})/g;
    let match: RegExpExecArray | null;

    while ((match = directorRegex.exec(text)) !== null) {
      const name = match[1]?.trim();
      if (name && name.length > 4 && !name.includes('GmbH') && !name.includes('AG')) {
        contacts.push({
          id: `con_dir_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          businessId,
          fullName: name,
          jobTitle: 'Managing Director / Inhaber',
          contactType: 'director',
          publiclyListed: true,
          verified: true,
          confidence: 0.96,
          sourceUrl: page.url,
          sourceType: 'impressum-legal-notice',
          collectedAt: new Date().toISOString(),
        });

        evidence.push({
          id: `ev_dir_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          businessId,
          fieldName: 'managing_director',
          fieldValue: name,
          sourceUrl: page.url,
          sourceType: 'statutory-impressum',
          confidence: 0.96,
          collectedAt: new Date().toISOString(),
          contentHash: crypto.createHash('sha256').update(name).digest('hex').substring(0, 16),
          snippet: `Statutory identification: ${match[0]}`,
        });
        break; // Conservatively extract the primary registered director
      }
    }
  }

  return { contacts, evidence };
}
