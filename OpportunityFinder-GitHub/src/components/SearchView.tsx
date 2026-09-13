import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  MapPin,
  Tag,
  Sliders,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Globe,
  Layers,
  Edit3,
  ListFilter,
  RotateCw,
  X,
  KeyRound,
  Users,
  Phone,
  FileX,
  Filter,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import { SearchRecord, SearchStage } from '../types';
import { checkBackendHealth, waitForBackendReady, apiFetch } from '../lib/api-client';
import {
  INDUSTRY_CATEGORY_GROUPS,
  ALL_PREDEFINED_CATEGORIES,
  POPULAR_CATEGORY_SHORTCUTS,
  PREDEFINED_COUNTRIES_DATA,
  getCitiesForCountry,
  getDefaultCityForCountry,
  getPopularCitiesForCountry,
  getCountryLocation,
} from '../data/categoriesAndLocations';

interface SearchViewProps {
  onExecuteSearch: (params: {
    country: string;
    city: string;
    radiusKm: number;
    category: string;
    keywords?: string;
    minOpportunityScore: number;
    provider: string;
    apifyToken?: string;
    maxResults?: number;
    onlyWithoutWebsite?: boolean;
    mustHaveWebsite?: boolean;
    requirePhone?: boolean;
    opportunityFocus?: 'all' | 'no_website' | 'performance_mobile' | 'seo_security';
    sortPriority?: 'opportunity_score' | 'conversion_potential' | 'distance';
  }) => Promise<SearchRecord>;
  activeSearch: SearchRecord | null;
  recentSearches: SearchRecord[];
  onViewResults: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onExecuteSearch,
  activeSearch,
  recentSearches,
  onViewResults,
}) => {
  const [country, setCountry] = useState('Germany');
  const [isCustomCountry, setIsCustomCountry] = useState(false);

  const [city, setCity] = useState('Frankfurt am Main');
  const [isCustomCity, setIsCustomCity] = useState(false);

  const [category, setCategory] = useState('Dentist');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const [radiusKm, setRadiusKm] = useState(20);
  const [keywords, setKeywords] = useState('');
  const [minOpportunityScore, setMinOpportunityScore] = useState(60);
  const [provider, setProvider] = useState('apify_google_maps');
  const [apifyToken, setApifyToken] = useState('');
  const [apifyConfigured, setApifyConfigured] = useState(true);
  const [maxResults, setMaxResults] = useState<number>(20);
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState<boolean>(false);
  const [mustHaveWebsite, setMustHaveWebsite] = useState<boolean>(false);
  const [requirePhone, setRequirePhone] = useState<boolean>(false);
  const [opportunityFocus, setOpportunityFocus] = useState<'all' | 'no_website' | 'performance_mobile' | 'seo_security'>('all');
  const [sortPriority, setSortPriority] = useState<'opportunity_score' | 'conversion_potential' | 'distance'>('opportunity_score');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check external configuration (Apify Google Maps)
  useEffect(() => {
    apiFetch<{ apifyConfigured: boolean }>('/api/config')
      .then((cfg) => {
        if (cfg.apifyConfigured) {
          setApifyConfigured(true);
        }
        setProvider('apify_google_maps');
      })
      .catch(() => {
        setProvider('apify_google_maps');
      });
  }, []);

  // Available cities dynamically derived from country selection
  const currentCities = useMemo(() => {
    return getCitiesForCountry(country);
  }, [country]);

  // Popular city shortcuts for selected country
  const popularCities = useMemo(() => {
    return getPopularCitiesForCountry(country);
  }, [country]);

  // Handle country selection
  const handleCountrySelect = (selectedCountry: string) => {
    if (selectedCountry === '__CUSTOM__') {
      setIsCustomCountry(true);
      setIsCustomCity(true);
      setCountry('');
      setCity('');
      return;
    }

    setIsCustomCountry(false);
    setCountry(selectedCountry);

    // Auto-update to default city for the chosen country
    const newDefaultCity = getDefaultCityForCountry(selectedCountry);
    setCity(newDefaultCity);
    setIsCustomCity(false);
  };

  // Handle city selection
  const handleCitySelect = (selectedCity: string) => {
    if (selectedCity === '__CUSTOM__') {
      setIsCustomCity(true);
      setCity('');
      return;
    }
    setIsCustomCity(false);
    setCity(selectedCity);
  };

  // Handle category selection
  const handleCategorySelect = (selectedCat: string) => {
    if (selectedCat === '__CUSTOM__') {
      setIsCustomCategory(true);
      setCategory('');
      return;
    }
    setIsCustomCategory(false);
    setCategory(selectedCat);
  };

  const executeSearchSubmission = async () => {
    const cleanCountry = country.trim();
    const cleanCity = city.trim();
    const cleanCat = category.trim();

    if (!cleanCountry) {
      setError('Please select or specify a Country.');
      return;
    }
    if (!cleanCity) {
      setError('Please select or specify a City / Region.');
      return;
    }
    if (!cleanCat) {
      setError('Please select or specify an Industry / Business Category.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onExecuteSearch({
        country: cleanCountry,
        city: cleanCity,
        radiusKm,
        category: cleanCat,
        keywords: keywords.trim() ? keywords : undefined,
        minOpportunityScore,
        provider: 'apify_google_maps',
        apifyToken: apifyToken.trim() ? apifyToken.trim() : undefined,
        maxResults: Math.min(1000, Math.max(1, maxResults || 20)),
        onlyWithoutWebsite,
        mustHaveWebsite,
        requirePhone,
        opportunityFocus,
        sortPriority,
      });
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch search');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSearchSubmission();
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await executeSearchSubmission();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch search');
    } finally {
      setIsRetrying(false);
    }
  };

  // Background auto-retry when service warm-up is detected
  useEffect(() => {
    if (!error) return;
    const isWarmup =
      error.toLowerCase().includes('warming up') ||
      error.toLowerCase().includes('warmup') ||
      error.toLowerCase().includes('starting') ||
      error.toLowerCase().includes('initializing') ||
      error.toLowerCase().includes('could not be found') ||
      error.toLowerCase().includes('connecting to business');

    if (!isWarmup) return;

    let isCancelled = false;
    const timer = setTimeout(async () => {
      if (isCancelled || isSubmitting || isRetrying) return;
      setIsRetrying(true);
      try {
        await executeSearchSubmission();
      } catch {
        // Handled in executeSearchSubmission
      } finally {
        if (!isCancelled) setIsRetrying(false);
      }
    }, 1500);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [error, isSubmitting, isRetrying]);

  const STAGES: { id: SearchStage; label: string; desc: string }[] = [
    { id: 'DISCOVERY', label: 'Discovery', desc: 'Querying compliant provider registry' },
    { id: 'WEBSITE_CHECK', label: 'DNS & Site Check', desc: 'Verifying official domain & SSL' },
    { id: 'CRAWLING', label: 'Safe Crawl', desc: 'SSRF-guarded HTTP content extraction' },
    { id: 'PERFORMANCE', label: 'Performance', desc: 'Measuring LCP, FCP & layout shift' },
    { id: 'MOBILE', label: 'Mobile Audit', desc: 'Evaluating viewport & responsive layout' },
    { id: 'CONTACT_EXTRACTION', label: 'Contacts', desc: 'Extracting public emails & impressum' },
    { id: 'AI_ANALYSIS', label: 'Gemini AI', desc: 'Synthesizing commercial opportunity' },
    { id: 'SCORING', label: 'Deterministic Scoring', desc: 'Calculating final Opportunity Score' },
    { id: 'COMPLETE', label: 'Complete', desc: 'Leads normalized in workspace' },
  ];

  const currentStageIndex = activeSearch
    ? STAGES.findIndex((s) => s.id === activeSearch.stage)
    : -1;

  // Check if current city is in the predefined list for this country
  const isCityInPredefinedList = currentCities.includes(city);

  // Check if current category is in predefined list
  const isCategoryInPredefinedList = ALL_PREDEFINED_CATEGORIES.includes(category);

  return (
    <div className="space-y-8">
      {/* Search Header */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          AI Business Discovery Engine
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Scan municipal registries, open business datasets, or Google Places for local opportunities with weak digital presence.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Search Config Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
            {error && (
              <div
                className={`rounded-lg border p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  error.toLowerCase().includes('warmup') ||
                  error.toLowerCase().includes('warming up') ||
                  error.toLowerCase().includes('starting') ||
                  error.toLowerCase().includes('initializing') ||
                  error.toLowerCase().includes('could not be found') ||
                  error.toLowerCase().includes('connecting to business')
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isRetrying ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                  ) : (
                    <AlertCircle
                      className={`h-4 w-4 shrink-0 ${
                        error.toLowerCase().includes('warmup') ||
                        error.toLowerCase().includes('warming up') ||
                        error.toLowerCase().includes('starting') ||
                        error.toLowerCase().includes('initializing') ||
                        error.toLowerCase().includes('could not be found') ||
                        error.toLowerCase().includes('connecting to business')
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    />
                  )}
                  <div>
                    <span className="font-medium">
                      {isRetrying
                        ? 'Connecting to discovery engine...'
                        : error.toLowerCase().includes('could not be found')
                        ? 'Connecting to business discovery engine... Initializing search pipeline.'
                        : error}
                    </span>
                    {(error.toLowerCase().includes('warmup') ||
                      error.toLowerCase().includes('warming up') ||
                      error.toLowerCase().includes('could not be found') ||
                      error.toLowerCase().includes('initializing') ||
                      error.toLowerCase().includes('connecting to business')) &&
                      !isRetrying && (
                        <p className="text-[11px] text-amber-300/80 mt-0.5">
                          Auto-reconnecting in background, or click Retry Now.
                        </p>
                      )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={isSubmitting || isRetrying}
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-medium text-[11px] transition-colors border border-zinc-700 disabled:opacity-50"
                  >
                    {isRetrying ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <RotateCw className="h-3 w-3 text-indigo-400" />
                        Retry Now
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="p-1 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Row 1: Country & City / Region */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Country Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-indigo-400" />
                    Country
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCountry(!isCustomCountry);
                      if (!isCustomCountry) {
                        setIsCustomCity(true);
                      }
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    {isCustomCountry ? (
                      <>
                        <ListFilter className="h-3 w-3" />
                        Select list
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-3 w-3" />
                        Custom
                      </>
                    )}
                  </button>
                </label>

                {!isCustomCountry ? (
                  <select
                    id="search-country-select"
                    value={country}
                    onChange={(e) => handleCountrySelect(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {PREDEFINED_COUNTRIES_DATA.map((c) => (
                      <option key={c.country} value={c.country}>
                        {c.flag} {c.country}
                      </option>
                    ))}
                    <option value="__CUSTOM__">🌐 Other Country (Type custom...)</option>
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      id="search-country-custom-input"
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Enter country (e.g. Sweden, New Zealand)"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                )}
                <p className="mt-1 text-[11px] text-zinc-500">
                  Select a country to auto-populate regional cities.
                </p>
              </div>

              {/* City / Region Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                    City / Region
                  </span>
                  {!isCustomCountry && currentCities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomCity(!isCustomCity)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      {isCustomCity ? (
                        <>
                          <ListFilter className="h-3 w-3" />
                          Predefined list
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-3 w-3" />
                          Custom city
                        </>
                      )}
                    </button>
                  )}
                </label>

                {!isCustomCity && currentCities.length > 0 ? (
                  <select
                    id="search-city-select"
                    value={isCityInPredefinedList ? city : '__CUSTOM__'}
                    onChange={(e) => handleCitySelect(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {!isCityInPredefinedList && city && (
                      <option value={city}>{city} (Current)</option>
                    )}
                    {currentCities.map((cityName) => (
                      <option key={cityName} value={cityName}>
                        {cityName}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Enter custom city / town...</option>
                  </select>
                ) : (
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      id="search-city-custom-input"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={`Enter city or municipality in ${country || 'target region'}`}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                )}

                {/* Popular City Quick Chips for Selected Country */}
                {popularCities.length > 0 && !isCustomCountry && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Top:</span>
                    {popularCities.map((pCity) => (
                      <button
                        key={pCity}
                        type="button"
                        onClick={() => {
                          setCity(pCity);
                          setIsCustomCity(false);
                        }}
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                          city === pCity
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {pCity}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Industry / Business Category Selection & Radius */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-indigo-400" />
                    Industry / Business Category
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    {isCustomCategory ? (
                      <>
                        <ListFilter className="h-3 w-3" />
                        Predefined niches
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-3 w-3" />
                        Custom niche
                      </>
                    )}
                  </button>
                </label>

                {!isCustomCategory ? (
                  <select
                    id="search-category-select"
                    value={isCategoryInPredefinedList ? category : '__CUSTOM__'}
                    onChange={(e) => handleCategorySelect(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {!isCategoryInPredefinedList && category && (
                      <option value={category}>{category} (Custom Selection)</option>
                    )}
                    {INDUSTRY_CATEGORY_GROUPS.map((group) => (
                      <optgroup key={group.name} label={group.name}>
                        {group.categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__CUSTOM__">+ Enter custom industry / niche...</option>
                  </select>
                ) : (
                  <div className="relative">
                    <Tag className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      id="search-category-custom-input"
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Dentist, Roofer, Orthodontist, Law Firm"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                )}

                {/* Popular Category Shortcuts */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Popular:</span>
                  {POPULAR_CATEGORY_SHORTCUTS.slice(0, 6).map((catName) => (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => {
                        setCategory(catName);
                        setIsCustomCategory(false);
                      }}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                        category === catName
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {catName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Search Radius: {radiusKm} km</span>
                  <span className="text-[11px] text-zinc-500">Surrounding metropolitan zone</span>
                </label>
                <div className="pt-2">
                  <input
                    id="search-radius-slider"
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>5 km (City Center)</span>
                  <span>25 km (Metro Area)</span>
                  <span>100 km (Regional)</span>
                </div>
              </div>
            </div>

            {/* Row 3: Provider Selector & Min Opportunity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-indigo-400" />
                    Discovery Provider
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Live Google Places
                  </span>
                </label>

                <div className="p-3 rounded-lg border border-indigo-500/40 bg-indigo-950/20 shadow-sm">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Apify Google Maps Scraper</span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 uppercase tracking-wide">
                        100% Genuine Data
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Official live Google Maps places scraper. Extracts real registered addresses, verified phone numbers, ratings, and websites.
                    </p>
                  </div>
                </div>

                <div className="mt-2 p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
                      Custom Apify Token (Optional override)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">Active from .env</span>
                  </div>
                  <input
                    type="password"
                    placeholder="Using configured APIFY_API_TOKEN (or paste custom token)"
                    value={apifyToken}
                    onChange={(e) => setApifyToken(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-zinc-400" />
                    Min Opportunity Score
                  </span>
                  <span className="text-indigo-400 font-semibold">{minOpportunityScore}/100</span>
                </label>
                <div className="pt-2">
                  <input
                    id="search-min-opp-slider"
                    type="range"
                    min="0"
                    max="90"
                    step="5"
                    value={minOpportunityScore}
                    onChange={(e) => setMinOpportunityScore(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Focuses scanner on high-value digital agency targets
                </p>
              </div>
            </div>

            {/* Row 4: Leads Quantity Limit (Min 5, Max 1000) */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label htmlFor="search-max-results-input" className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 cursor-pointer">
                    <Users className="h-4 w-4 text-indigo-400" />
                    <span>Leads Quantity Limit</span>
                    <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                      5 – 1,000 Leads
                    </span>
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Specify the exact target number of business opportunities to discover & audit.
                  </p>
                </div>

                {/* Direct Number Input */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs text-zinc-400 font-medium">Quantity:</span>
                  <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                    <input
                      id="search-max-results-input"
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      value={maxResults}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value, 10);
                        if (isNaN(raw)) {
                          setMaxResults(1);
                        } else {
                          setMaxResults(Math.min(1000, Math.max(1, raw)));
                        }
                      }}
                      onBlur={() => {
                        if (maxResults < 1) setMaxResults(1);
                        if (maxResults > 1000) setMaxResults(1000);
                      }}
                      className="w-20 bg-transparent text-sm font-bold text-indigo-300 text-right focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-400 font-medium select-none">leads</span>
                  </div>
                </div>
              </div>

              {/* Range Slider for Fluid Adjustment */}
              <div className="space-y-1 pt-1">
                <input
                  id="search-max-results-slider"
                  type="range"
                  min="1"
                  max="1000"
                  step="1"
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                  <span>1 (Min)</span>
                  <span>250</span>
                  <span>500</span>
                  <span>750</span>
                  <span>1,000 (Max)</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/60">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider mr-1">
                  Quick Presets:
                </span>
                {[
                  { label: '1 (Single)', val: 1 },
                  { label: '5', val: 5 },
                  { label: '10', val: 10 },
                  { label: '20 (Default)', val: 20 },
                  { label: '50', val: 50 },
                  { label: '100 (Deep)', val: 100 },
                  { label: '250', val: 250 },
                  { label: '500', val: 500 },
                  { label: '1,000 (Max)', val: 1000 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setMaxResults(preset.val)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      maxResults === preset.val
                        ? 'bg-indigo-600 text-white shadow ring-1 ring-indigo-400'
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 5: Advanced Lead Targeting & Opportunity Quality */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-indigo-400" />
                  Advanced Targeting & Conversion Filters
                </span>
                <span className="text-[11px] text-zinc-400">Target highest-probability clients</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Toggle 1: Only without website */}
                <label
                  htmlFor="filter-no-website-toggle"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer select-none transition-all ${
                    onlyWithoutWebsite
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-100 shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <input
                    id="filter-no-website-toggle"
                    type="checkbox"
                    checked={onlyWithoutWebsite}
                    onChange={(e) => {
                      setOnlyWithoutWebsite(e.target.checked);
                      if (e.target.checked) setMustHaveWebsite(false);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <FileX className="h-3.5 w-3.5 text-amber-400" />
                      <span>No Website Only</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Only return businesses with zero web presence. Perfect for new starter websites.
                    </p>
                  </div>
                </label>

                {/* Toggle 2: Must have website */}
                <label
                  htmlFor="filter-must-have-website-toggle"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer select-none transition-all ${
                    mustHaveWebsite
                      ? 'border-blue-500/60 bg-blue-500/10 text-blue-100 shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <input
                    id="filter-must-have-website-toggle"
                    type="checkbox"
                    checked={mustHaveWebsite}
                    onChange={(e) => {
                      setMustHaveWebsite(e.target.checked);
                      if (e.target.checked) setOnlyWithoutWebsite(false);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-700 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-blue-400" />
                      <span>Must Have Website</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Only return businesses with an existing website. Ideal for redesigns & SEO audits.
                    </p>
                  </div>
                </label>

                {/* Toggle 3: Require verified phone number */}
                <label
                  htmlFor="filter-phone-toggle"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer select-none transition-all ${
                    requirePhone
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100 shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <input
                    id="filter-phone-toggle"
                    type="checkbox"
                    checked={requirePhone}
                    onChange={(e) => setRequirePhone(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Require Phone</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Exclude businesses without a verified phone number for cold calls & WhatsApp.
                    </p>
                  </div>
                </label>
              </div>

              {/* Opportunity Focus and Sorting Strategy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/70">
                <div>
                  <label htmlFor="opportunity-focus-select" className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    Opportunity Focus Target
                  </label>
                  <select
                    id="opportunity-focus-select"
                    value={opportunityFocus}
                    onChange={(e) => setOpportunityFocus(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="all">All Digital Deficits (Broad Scan)</option>
                    <option value="no_website">Zero Web Presence (Missing Website Only)</option>
                    <option value="performance_mobile">Performance & Mobile Issues (Slow / Non-responsive)</option>
                    <option value="seo_security">SEO & Security Gaps (Missing SSL / Outdated Tech)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sort-priority-select" className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
                    Lead Ranking Strategy
                  </label>
                  <select
                    id="sort-priority-select"
                    value={sortPriority}
                    onChange={(e) => setSortPriority(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="opportunity_score">Highest Opportunity Score First (Worst Sites First)</option>
                    <option value="conversion_potential">Fastest Deal Potential (No-site & Direct Phone First)</option>
                    <option value="distance">Closest Distance First (City Center Outwards)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                id="execute-search-btn"
                type="submit"
                disabled={isSubmitting || activeSearch?.status === 'PROCESSING'}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isSubmitting || activeSearch?.status === 'PROCESSING' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning & Auditing...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Find Local Opportunities
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Live Progress Card (Active Pipeline) */}
          {activeSearch && (
            <div className="rounded-xl border border-indigo-500/30 bg-zinc-900/80 p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {activeSearch.status === 'PROCESSING' ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : activeSearch.status === 'COMPLETED' ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {activeSearch.status === 'COMPLETED'
                        ? 'Discovery Scan Completed!'
                        : activeSearch.status === 'FAILED'
                        ? 'Scan Encountered Issue'
                        : `Executing: ${activeSearch.stage}`}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Targeting {activeSearch.params.category} in {activeSearch.params.city} ({activeSearch.params.country})
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-lg font-bold text-indigo-400">
                    {activeSearch.progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${activeSearch.progressPercent}%` }}
                />
              </div>

              {/* Live KPI Tally */}
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-zinc-800/80 text-center">
                <div className="p-2 rounded bg-zinc-950/60">
                  <div className="text-xs text-zinc-400">Discovered</div>
                  <div className="text-sm font-semibold text-white">{activeSearch.totalDiscovered}</div>
                </div>
                <div className="p-2 rounded bg-zinc-950/60">
                  <div className="text-xs text-zinc-400">Websites</div>
                  <div className="text-sm font-semibold text-emerald-400">{activeSearch.websitesFound}</div>
                </div>
                <div className="p-2 rounded bg-zinc-950/60">
                  <div className="text-xs text-zinc-400">No Website</div>
                  <div className="text-sm font-semibold text-amber-400">{activeSearch.noWebsites}</div>
                </div>
                <div className="p-2 rounded bg-zinc-950/60">
                  <div className="text-xs text-zinc-400">High Opp.</div>
                  <div className="text-sm font-semibold text-purple-400">{activeSearch.highOpportunities}</div>
                </div>
              </div>

              {/* Stage Stepper Checklist */}
              <div className="space-y-1.5 pt-2">
                {STAGES.map((s, idx) => {
                  const isDone = currentStageIndex > idx || activeSearch.status === 'COMPLETED';
                  const isCurrent = currentStageIndex === idx && activeSearch.status === 'PROCESSING';

                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : isCurrent ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-zinc-700" />
                        )}
                        <span className={isCurrent ? 'font-medium text-white' : isDone ? 'text-zinc-300' : 'text-zinc-500'}>
                          {s.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500">{s.desc}</span>
                    </div>
                  );
                })}
              </div>

              {activeSearch.status === 'FAILED' && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-2">
                  <div className="font-semibold text-rose-200 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                    Scan Processing Alert
                  </div>
                  <div className="text-zinc-300 text-[11px] leading-relaxed">
                    {activeSearch.errorMessage || 'An error occurred while executing the search pipeline. Please try running the search again.'}
                  </div>
                </div>
              )}

              {activeSearch.status === 'COMPLETED' && (
                <div className="pt-3 border-t border-zinc-800 flex justify-end">
                  <button
                    id="view-discovered-leads-btn"
                    onClick={onViewResults}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
                  >
                    View All Discovered Leads
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Recent Searches & Discovery Info */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Recent Discovery Scans</h3>
            {recentSearches.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">No scans run yet in this workspace.</p>
            ) : (
              <div className="space-y-2.5">
                {recentSearches.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setCountry(s.params.country);
                      setCity(s.params.city);
                      setCategory(s.params.category);
                      setIsCustomCountry(false);
                      setIsCustomCity(false);
                      setIsCustomCategory(false);
                    }}
                    className="p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 cursor-pointer text-xs space-y-1 group transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200 group-hover:text-indigo-400 transition-colors">
                        {s.params.category} &bull; {s.params.city}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${s.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-500 text-[11px]">
                      <span>{s.totalDiscovered} found ({s.noWebsites} no site)</span>
                      <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3 text-xs text-zinc-400">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Compliance & Safety Mandate
            </h3>
            <p className="leading-relaxed">
              Every discovered record tracks license provenance. Crawling enforces rigorous <strong>SSRF protection</strong> against private IP ranges and adheres to robots policies.
            </p>
            <div className="rounded bg-zinc-950 p-2.5 border border-zinc-800 text-[11px] text-zinc-500">
              No unofficial Google Maps DOM scraping is executed. Official Google Places Web APIs or licensed open city registers are utilized exclusively.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
