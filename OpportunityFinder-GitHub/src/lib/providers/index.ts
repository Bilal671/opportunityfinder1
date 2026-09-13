import { SearchParams, DiscoveredBusiness } from '../../types';
import { ApifyGoogleMapsProvider, DiscoveryProvider } from './apify-provider';

export { ApifyGoogleMapsProvider };
export type { DiscoveryProvider };

/**
 * ProviderRegistry:
 * Exclusively manages genuine, authenticated data sources.
 * Fake, mock, and synthetic providers have been completely removed.
 */
export class ProviderRegistry {
  private providers = new Map<string, DiscoveryProvider>();

  constructor() {
    this.register(new ApifyGoogleMapsProvider());
  }

  register(provider: DiscoveryProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id?: string): DiscoveryProvider {
    return this.providers.get('apify_google_maps') || new ApifyGoogleMapsProvider();
  }

  getAll(): DiscoveryProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
