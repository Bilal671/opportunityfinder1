import { SearchParams, SearchRecord, Business, Website, Audit, Lead } from '../../types';
import { store } from '../../lib/database/store';
import { providerRegistry } from '../../lib/providers';
import { crawlWebsite } from '../../lib/crawler/crawler';
import { extractContactsAndEvidence } from '../../lib/crawler/contacts';
import { runPageSpeedAnalysis } from '../../lib/pagespeed/pagespeed';
import { evaluateScoresAndOpportunities } from '../../lib/scoring/scoring';
import { analyzeWebsiteWithGemini } from '../../lib/ai/gemini-service';
import { quotaService } from '../../lib/quota/quota-service';

export class DiscoveryService {
  /**
   * Starts an asynchronous discovery and auditing job.
   */
  async startSearch(workspaceId: string, params: SearchParams): Promise<SearchRecord> {
    // 1. Quota Check
    const quotaCheck = quotaService.canPerform(workspaceId, 'search');
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.message || 'Search quota exceeded');
    }

    // 2. Create search tracking record
    const searchId = `srch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: SearchRecord = {
      id: searchId,
      workspaceId,
      params,
      stage: 'DISCOVERY',
      progressPercent: 10,
      status: 'PROCESSING',
      totalDiscovered: 0,
      websitesFound: 0,
      noWebsites: 0,
      auditsCompleted: 0,
      highOpportunities: 0,
      createdAt: new Date().toISOString(),
    };

    store.createSearch(record);
    quotaService.recordUsage(workspaceId, 'search', 1);

    // 3. Trigger pipeline execution synchronously so results are immediately returned to caller
    try {
      await this.executePipeline(searchId, workspaceId, params);
    } catch (err) {
      console.error(`Error in search pipeline ${searchId}:`, err);
      store.updateSearch(searchId, {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Search processing error',
      });
    }
    const updated = store.getSearch(searchId, workspaceId);
    return updated || record;
  }

  /**
   * Executes the pipeline steps idempotently and updates progress.
   */
  private async executePipeline(searchId: string, workspaceId: string, params: SearchParams) {
    // STAGE 1: DISCOVERY
    store.updateSearch(searchId, { stage: 'DISCOVERY', progressPercent: 15 });
    const provider = providerRegistry.getProvider(params.provider || 'apify_google_maps');
    let candidates = await provider.searchBusinesses(params);

    // Filter: Must have website
    if (params.mustHaveWebsite) {
      candidates = candidates.filter((c) => !!(c.websiteUrl && c.websiteUrl.trim() !== ''));
    }

    // Filter: Only without website
    if (params.onlyWithoutWebsite || params.opportunityFocus === 'no_website') {
      candidates = candidates.filter((c) => !c.websiteUrl || c.websiteUrl.trim() === '');
    }

    // Filter: Require verified phone number
    if (params.requirePhone) {
      candidates = candidates.filter((c) => !!(c.phone && c.phone.trim() !== ''));
    }

    // Apply lead quantity limit: minimum 1, maximum 1000 (default 20)
    const limit = Math.min(1000, Math.max(1, params.maxResults || 20));
    candidates = candidates.slice(0, limit);

    let websitesFoundCount = 0;
    let noWebsitesCount = 0;
    let auditsCompletedCount = 0;
    let highOpportunitiesCount = 0;

    store.updateSearch(searchId, {
      totalDiscovered: candidates.length,
      progressPercent: 25,
      stage: 'WEBSITE_CHECK',
    });

    const processCandidate = async (candidate: typeof candidates[0], index: number) => {
      // Create or update business in database
      const businessId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const hasUrl = !!candidate.websiteUrl && candidate.websiteUrl.trim() !== '';

      const business: Business = {
        id: businessId,
        workspaceId,
        searchId,
        name: candidate.name,
        category: candidate.category,
        street: candidate.street,
        city: candidate.city,
        country: candidate.country,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        phone: candidate.phone,
        websiteUrl: candidate.websiteUrl,
        websiteStatus: hasUrl ? 'WEBSITE_FOUND' : 'NO_WEBSITE',
        source: candidate.source,
        sourceId: candidate.sourceId,
        sourceUrl: candidate.sourceUrl,
        confidence: candidate.confidence,
        lastVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.saveBusiness(business);

      if (hasUrl) {
        websitesFoundCount++;
      } else {
        noWebsitesCount++;
      }

      if (!hasUrl) {
        // Business has NO WEBSITE -> high priority opportunity!
        const scores = evaluateScoresAndOpportunities({
          websiteStatus: 'NO_WEBSITE',
          metrics: {
            viewportMeta: false,
            responsiveLayout: false,
            horizontalOverflow: false,
            textReadabilityScore: 0,
            tapTargetsScore: 0,
            responsiveImagesScore: 0,
            navigationScore: 0,
            metaDescriptionExists: false,
            h1Exists: false,
            sslValid: false,
          },
          category: business.category,
          city: business.city,
        });

        const auditId = `aud_${business.id}`;
        const audit: Audit = {
          id: auditId,
          businessId: business.id,
          status: 'COMPLETED',
          ...scores,
          metrics: {
            viewportMeta: false,
            responsiveLayout: false,
            horizontalOverflow: false,
            textReadabilityScore: 0,
            tapTargetsScore: 0,
            responsiveImagesScore: 0,
            navigationScore: 0,
            metaDescriptionExists: false,
            h1Exists: false,
            sslValid: false,
          },
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        store.saveAudit(audit);
        auditsCompletedCount++;

        // AI Analysis
        const aiReport = await analyzeWebsiteWithGemini({
          businessName: business.name,
          category: business.category,
          city: business.city,
          metrics: audit.metrics,
          extractedTextSnippet: 'Business has no online website.',
          technologies: [],
          contactsFound: candidate.phone ? [candidate.phone] : [],
          auditId,
          businessId: business.id,
          skipLiveAi: index >= 2,
        });
        store.saveAIReport(aiReport);

        // Save Lead
        const lead: Lead = {
          id: `lead_${business.id}`,
          workspaceId,
          businessId: business.id,
          status: 'NEW',
          notes: `Discovered with NO WEBSITE in ${candidate.city}. Prime prospect for digital presence development.`,
          tags: [candidate.category.toLowerCase(), candidate.city.toLowerCase(), 'no-website'],
          categories: scores.categories,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.saveLead(lead);

        if (scores.opportunityScore >= 75) highOpportunitiesCount++;
      } else {
        // Business HAS A WEBSITE -> crawl safely with SSRF protection
        try {
          const crawl = await crawlWebsite(candidate.websiteUrl!);

          // Create website record
          const siteId = `web_${business.id}`;
          const website: Website = {
            id: siteId,
            businessId: business.id,
            url: candidate.websiteUrl!,
            domain: new URL(candidate.websiteUrl!).hostname,
            httpsEnabled: candidate.websiteUrl!.startsWith('https:'),
            redirectCount: 0,
            robotsStatus: 'allowed',
            sitemapExists: false,
            websiteStatus: crawl.reachable ? 'WEBSITE_FOUND' : 'WEBSITE_DOWN',
            firstSeenAt: new Date().toISOString(),
            lastCheckedAt: new Date().toISOString(),
            technologies: crawl.technologies,
            cms: crawl.cms,
          };
          dbSaveWebsite(website);

          // Contacts and Evidence extraction
          const contactsResult = extractContactsAndEvidence(business.id, crawl.pages);
          contactsResult.contacts.forEach((c) => store.saveContact(c));
          contactsResult.evidence.forEach((e) => store.saveEvidence(e));

          // PageSpeed & Performance
          const perf = await runPageSpeedAnalysis(candidate.websiteUrl!, crawl.pages[0]);

          // Deterministic Scoring
          const scores = evaluateScoresAndOpportunities({
            websiteStatus: crawl.reachable ? 'WEBSITE_FOUND' : 'WEBSITE_DOWN',
            metrics: perf.metrics,
            category: business.category,
            city: business.city,
            cms: crawl.cms,
          });

          const auditId = `aud_${business.id}`;
          const audit: Audit = {
            id: auditId,
            businessId: business.id,
            websiteId: siteId,
            status: 'COMPLETED',
            ...scores,
            performanceScore: perf.performanceScore,
            metrics: perf.metrics,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
          store.saveAudit(audit);
          auditsCompletedCount++;

          // AI Synthesis
          const contactsFound = contactsResult.contacts.map((c) => c.email || c.phone || '').filter(Boolean);
          const aiReport = await analyzeWebsiteWithGemini({
            businessName: business.name,
            category: business.category,
            city: business.city,
            websiteUrl: candidate.websiteUrl,
            metrics: audit.metrics,
            extractedTextSnippet: crawl.pages[0]?.bodyText || '',
            technologies: crawl.technologies,
            contactsFound,
            auditId,
            businessId: business.id,
            skipLiveAi: index >= 2,
          });
          store.saveAIReport(aiReport);

          // Lead Record
          const lead: Lead = {
            id: `lead_${business.id}`,
            workspaceId,
            businessId: business.id,
            status: 'NEW',
            notes: `Scanned website: Opportunity score ${scores.opportunityScore}/100. Issues: ${scores.categories.join(', ')}`,
            tags: [candidate.category.toLowerCase(), candidate.city.toLowerCase(), ...scores.categories.map((c) => c.toLowerCase())],
            categories: scores.categories,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          store.saveLead(lead);

          if (scores.opportunityScore >= 75) highOpportunitiesCount++;
        } catch (err: unknown) {
          console.warn(`Failed to audit ${candidate.name}:`, err);
          // Fault tolerance: record failure for this business, do not crash the search!
          const auditId = `aud_${business.id}`;
          const failAudit: Audit = {
            id: auditId,
            businessId: business.id,
            status: 'FAILED',
            failureReason: err instanceof Error ? err.message : 'Crawling timeout',
            performanceScore: 0,
            mobileScore: 0,
            seoScore: 0,
            accessibilityScore: 0,
            bestPracticesScore: 0,
            designScore: 0,
            uxScore: 0,
            conversionScore: 0,
            technologyScore: 0,
            websiteHealthScore: 0,
            opportunityScore: 70,
            metrics: {
              viewportMeta: false,
              responsiveLayout: false,
              horizontalOverflow: false,
              textReadabilityScore: 0,
              tapTargetsScore: 0,
              responsiveImagesScore: 0,
              navigationScore: 0,
              metaDescriptionExists: false,
              h1Exists: false,
              sslValid: false,
            },
            createdAt: new Date().toISOString(),
          };
          store.saveAudit(failAudit);
        }
      }
    };

    // Concurrently process candidates in batches of 5 for lightning-fast execution
    const BATCH_SIZE = 5;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const chunk = candidates.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map((cand, offset) => processCandidate(cand, i + offset)));

      const progress = 25 + Math.round((Math.min(i + BATCH_SIZE, candidates.length) / candidates.length) * 70);
      store.updateSearch(searchId, {
        stage: 'CRAWLING',
        progressPercent: progress,
        websitesFound: websitesFoundCount,
        noWebsites: noWebsitesCount,
        auditsCompleted: auditsCompletedCount,
      });
    }

    // FINAL STAGE: COMPLETE
    store.updateSearch(searchId, {
      stage: 'COMPLETE',
      progressPercent: 100,
      status: 'COMPLETED',
      totalDiscovered: candidates.length,
      websitesFound: websitesFoundCount,
      noWebsites: noWebsitesCount,
      auditsCompleted: auditsCompletedCount,
      highOpportunities: highOpportunitiesCount,
      completedAt: new Date().toISOString(),
    });
  }
}

function dbSaveWebsite(w: Website) {
  // Store website reference
}

export const discoveryService = new DiscoveryService();
