import { validateUrlSafety } from '../security/ssrf';

export interface CrawledPage {
  url: string;
  status: number;
  contentType: string;
  title?: string;
  metaDescription?: string;
  viewportMeta: boolean;
  hasHorizontalScrollIssue: boolean;
  bodyText: string;
  rawHtml: string;
  links: string[];
  cmsDetected?: string;
  sslValid: boolean;
  responseTimeMs: number;
}

export interface CrawlResult {
  reachable: boolean;
  finalUrl?: string;
  status?: number;
  failureReason?: string;
  pages: CrawledPage[];
  cms?: string;
  technologies: string[];
  viewportMeta: boolean;
  sslValid: boolean;
}

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB limit
const REQUEST_TIMEOUT_MS = 2000; // 2s limit to ensure auditing stays lightning fast
const MAX_REDIRECTS = 5;

/**
 * Safely fetches a page with SSRF protection, redirect verification, and size limits.
 */
export async function safeFetchPage(targetUrl: string): Promise<CrawledPage> {
  let currentUrl = targetUrl;
  let redirectCount = 0;

  // Fast bypass for example / testing placeholder domains
  if (
    currentUrl.includes('.example.de') ||
    currentUrl.includes('.example.com') ||
    currentUrl.includes('.example.org') ||
    currentUrl.includes('.test') ||
    currentUrl.includes('.invalid')
  ) {
    throw new Error('Example / mock domain placeholder is not a live web host');
  }

  while (redirectCount <= MAX_REDIRECTS) {
    // 1. SSRF Safety Check
    const ssrfCheck = await validateUrlSafety(currentUrl);
    if (!ssrfCheck.safe) {
      throw new Error(`SSRF blocked: ${ssrfCheck.reason}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startTime = Date.now();

    try {
      const res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual', // Manual redirects so we validate each hop against SSRF!
        headers: {
          'User-Agent': 'AILocalBusinessOpportunityBot/1.0 (+https://ai-business-finder.local/bot-policy)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      // Handle Redirects manually to enforce SSRF validation at every step
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`HTTP ${res.status} redirect with no location header`);
        }
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          throw new Error(`Exceeded max redirects limit of ${MAX_REDIRECTS}`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return {
          url: currentUrl,
          status: res.status,
          contentType,
          viewportMeta: false,
          hasHorizontalScrollIssue: false,
          bodyText: '',
          rawHtml: '',
          links: [],
          sslValid: currentUrl.startsWith('https:'),
          responseTimeMs,
        };
      }

      // Read limited body up to MAX_BODY_BYTES
      const reader = res.body?.getReader();
      let rawHtml = '';
      let bytesRead = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesRead += value.length;
          if (bytesRead > MAX_BODY_BYTES) {
            reader.cancel();
            break;
          }
          rawHtml += new TextDecoder('utf-8', { fatal: false }).decode(value, { stream: true });
        }
      } else {
        rawHtml = await res.text();
      }

      // Parse metadata & signals
      const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      const metaDescMatch = rawHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
      const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : undefined;

      const viewportMeta = /<meta[^>]*name=["']viewport["']/i.test(rawHtml);

      // Links extraction (priority pages)
      const linkMatches = rawHtml.matchAll(/href=["']([^"'#\s]+)["']/gi);
      const links: string[] = [];
      for (const m of linkMatches) {
        try {
          const resolved = new URL(m[1], currentUrl).toString();
          if (resolved.startsWith('http') && !links.includes(resolved)) {
            links.push(resolved);
          }
        } catch {
          // Ignore invalid link
        }
      }

      // Detect CMS
      let cmsDetected: string | undefined;
      if (rawHtml.includes('wp-content') || rawHtml.includes('wp-includes')) {
        cmsDetected = 'WordPress';
      } else if (rawHtml.includes('wix.com') || rawHtml.includes('wixsite')) {
        cmsDetected = 'Wix';
      } else if (rawHtml.includes('cdn.shopify.com')) {
        cmsDetected = 'Shopify';
      } else if (rawHtml.includes('squarespace.com')) {
        cmsDetected = 'Squarespace';
      } else if (rawHtml.includes('webflow.com')) {
        cmsDetected = 'Webflow';
      }

      // Strip tags for clean text
      const bodyText = rawHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        url: currentUrl,
        status: res.status,
        contentType,
        title,
        metaDescription,
        viewportMeta,
        hasHorizontalScrollIssue: !viewportMeta,
        bodyText,
        rawHtml: rawHtml.substring(0, 100000), // Keep bounded preview
        links,
        cmsDetected,
        sslValid: currentUrl.startsWith('https:'),
        responseTimeMs,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error('Exceeded maximum redirect hops.');
}

/**
 * Crawls a business website safely, including subpages (/impressum, /contact, /kontakt).
 */
export async function crawlWebsite(baseUrl: string): Promise<CrawlResult> {
  try {
    const mainPage = await safeFetchPage(baseUrl);

    const pages: CrawledPage[] = [mainPage];
    const technologies: string[] = [];

    if (mainPage.cmsDetected) technologies.push(mainPage.cmsDetected);
    if (mainPage.rawHtml.includes('google-analytics') || mainPage.rawHtml.includes('gtag(')) technologies.push('Google Analytics');
    if (mainPage.rawHtml.includes('googletagmanager.com')) technologies.push('Google Tag Manager');
    if (mainPage.rawHtml.includes('connect.facebook.net')) technologies.push('Meta Pixel');

    // Identify high-priority subpages (impressum, kontakt, team, about)
    const priorityKeywords = ['impressum', 'kontakt', 'contact', 'legal', 'ueber-uns', 'about', 'team'];
    const priorityUrls = mainPage.links.filter((link) => {
      try {
        const u = new URL(link);
        const baseU = new URL(baseUrl);
        if (u.hostname !== baseU.hostname) return false;
        return priorityKeywords.some((kw) => u.pathname.toLowerCase().includes(kw));
      } catch {
        return false;
      }
    });

    // Crawl up to 2 priority subpages concurrently
    const subpagePromises = priorityUrls.slice(0, 2).map((subUrl) => safeFetchPage(subUrl));
    const subResults = await Promise.allSettled(subpagePromises);
    for (const res of subResults) {
      if (res.status === 'fulfilled') {
        pages.push(res.value);
      }
    }

    return {
      reachable: mainPage.status >= 200 && mainPage.status < 400,
      finalUrl: mainPage.url,
      status: mainPage.status,
      pages,
      cms: mainPage.cmsDetected,
      technologies,
      viewportMeta: mainPage.viewportMeta,
      sslValid: mainPage.sslValid,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Crawling connection error';
    return {
      reachable: false,
      failureReason: msg,
      pages: [],
      technologies: [],
      viewportMeta: false,
      sslValid: baseUrl.startsWith('https:'),
    };
  }
}
