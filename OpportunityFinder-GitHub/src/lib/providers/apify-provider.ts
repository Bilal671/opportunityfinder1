import { SearchParams, DiscoveredBusiness } from '../../types';

export interface DiscoveryProvider {
  id: string;
  name: string;
  description: string;
  isConfigured(): boolean;
  searchBusinesses(params: SearchParams): Promise<DiscoveredBusiness[]>;
}

/**
 * Apify Google Maps Scraper Provider
 * Uses the industry standard Apify actor: compass/crawler-google-places
 * (compass~crawler-google-places / nwua9Gu5YrADL7ZDj) to scrape 100% genuine Google Maps places.
 */
export class ApifyGoogleMapsProvider implements DiscoveryProvider {
  id = 'apify_google_maps';
  name = 'Apify Google Maps (Official Live Places)';
  description = 'Direct live Google Maps scraper via Apify, extracting verified phone numbers, websites, and addresses.';

  isConfigured(): boolean {
    return !!(process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY);
  }

  async searchBusinesses(params: SearchParams): Promise<DiscoveredBusiness[]> {
    const apiToken =
      (params as any).apifyToken ||
      process.env.APIFY_API_TOKEN ||
      process.env.APIFY_API_KEY ||
      'apify_api_gMnxqT8NLK7tYWBzbKjlim3bTQp02S1aWqO1';

    const city = (params.city || 'Frankfurt am Main').trim();
    const country = (params.country || 'Germany').trim();
    const category = (params.category || 'Local Business').trim();
    const keywords = (params.keywords || '').trim();

    if (!apiToken) {
      throw new Error(
        'Apify API Token is missing. Please add your APIFY_API_TOKEN to .env or in the Settings tab.'
      );
    }

    const searchQuery = [category, keywords, `in ${city}`, country].filter(Boolean).join(' ');
    console.info(`[ApifyGoogleMapsProvider] Launching genuine Google Maps scrape for "${searchQuery}"`);

    // Limit: minimum 1, maximum 1000 (default 20)
    const limit = Math.min(1000, Math.max(1, params.maxResults || 20));

    // Actor ID: compass~crawler-google-places (nwua9Gu5YrADL7ZDj)
    const actorId = process.env.APIFY_ACTOR_ID || 'compass~crawler-google-places';

    const inputPayload = {
      searchStringsArray: [searchQuery],
      maxCrawledPlacesPerSearch: limit,
      language: 'en',
      skipClosedPlaces: true,
    };

    let items: Array<Record<string, any>> = [];

    // Method 1: Fast asynchronous run start with live dataset polling
    try {
      const startUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(apiToken)}`;
      const startRes = await fetch(startUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload),
      });

      if (startRes.ok) {
        const startData = (await startRes.json()) as { data?: { id?: string; defaultDatasetId?: string } };
        const runId = startData?.data?.id;
        const datasetId = startData?.data?.defaultDatasetId;

        if (runId && datasetId) {
          console.info(`[ApifyGoogleMapsProvider] Actor run started (${runId}), streaming dataset (${datasetId})...`);
          const pollStartTime = Date.now();
          const maxWaitMs = 52000; // Keep within standard HTTP / Vercel duration

          while (Date.now() - pollStartTime < maxWaitMs) {
            await new Promise((r) => setTimeout(r, 2500));

            // Poll dataset items directly
            const datasetUrl = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(apiToken)}&limit=${limit}`;
            const datasetRes = await fetch(datasetUrl);
            if (datasetRes.ok) {
              const currentItems = (await datasetRes.json()) as Array<Record<string, any>>;
              if (Array.isArray(currentItems) && currentItems.length > 0) {
                items = currentItems;
                if (items.length >= limit) {
                  console.info(`[ApifyGoogleMapsProvider] Reached requested limit of ${limit} items in ${Date.now() - pollStartTime}ms`);
                  break;
                }
              }
            }

            // Check run status
            const runStatusUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(apiToken)}`;
            const statusRes = await fetch(runStatusUrl);
            if (statusRes.ok) {
              const statusData = (await statusRes.json()) as { data?: { status?: string } };
              const status = statusData?.data?.status;
              if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'TIMED-OUT' || status === 'ABORTED') {
                // Fetch final dataset
                const finalDatasetRes = await fetch(
                  `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(apiToken)}&limit=${limit}`
                );
                if (finalDatasetRes.ok) {
                  items = (await finalDatasetRes.json()) as Array<Record<string, any>>;
                }
                break;
              }
            }
          }
        }
      }
    } catch (asyncErr) {
      console.warn('[ApifyGoogleMapsProvider] Async run polling failed, falling back to sync endpoint:', asyncErr);
    }

    // Method 2: Synchronous endpoint fallback if async method yielded 0 items
    if (!items || items.length === 0) {
      const syncEndpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(apiToken)}&timeout=50`;
      try {
        const syncRes = await fetch(syncEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(inputPayload),
        });

        if (syncRes.ok) {
          const syncItems = (await syncRes.json()) as Array<Record<string, any>>;
          if (Array.isArray(syncItems)) {
            items = syncItems;
          }
        }
      } catch (syncErr) {
        console.error('[ApifyGoogleMapsProvider] Sync call error:', syncErr);
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.warn(`[ApifyGoogleMapsProvider] 0 results returned by Google Maps via Apify for "${searchQuery}".`);
      return [];
    }

    console.info(`[ApifyGoogleMapsProvider] Successfully retrieved ${items.length} genuine Google Places`);

    const discovered: DiscoveredBusiness[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = item.title || item.name;
      if (!name) continue;

      const street = item.street || item.address || item.neighborhood || '';
      const phone = item.phone || item.phoneUnformatted || item.internationalPhone || '';
      const rawUrl = item.website || item.url || '';

      let websiteUrl: string | undefined = undefined;
      if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim()) {
        const u = rawUrl.trim();
        if (u.startsWith('http') && !u.includes('google.com/maps') && !u.includes('goo.gl')) {
          websiteUrl = u;
        }
      }

      const sourceId = item.placeId || item.id || `apify_gmp_${Date.now()}_${i}`;
      const sourceUrl = item.url || (item.placeId ? `https://maps.google.com/?q=place_id:${item.placeId}` : undefined);

      discovered.push({
        name: name.trim(),
        category: item.categoryName || category,
        street: street.trim(),
        city: item.city || city,
        country: item.countryCode || country,
        latitude: item.location?.lat,
        longitude: item.location?.lng,
        phone: phone ? String(phone).trim() : undefined,
        websiteUrl,
        source: 'apify_google_maps',
        sourceId,
        sourceUrl,
        confidence: 0.99,
      });
    }

    return discovered;
  }
}
