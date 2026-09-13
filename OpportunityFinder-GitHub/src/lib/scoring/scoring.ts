import { AuditMetrics, OpportunityCategory } from '../../types';

export interface CalculatedScores {
  mobileScore: number;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  designScore: number;
  uxScore: number;
  conversionScore: number;
  technologyScore: number;
  websiteHealthScore: number;
  opportunityScore: number;
  categories: OpportunityCategory[];
}

/**
 * Deterministic Mobile Analysis (Section 37):
 * - viewport: 20
 * - responsive layout: 20
 * - no horizontal overflow: 20
 * - text readability: 15
 * - tap targets: 10
 * - responsive images: 10
 * - mobile navigation: 5
 * Total: 100
 */
export function calculateMobileScore(metrics: Partial<AuditMetrics>): number {
  let score = 0;
  if (metrics.viewportMeta) score += 20;
  if (metrics.responsiveLayout) score += 20;
  if (!metrics.horizontalOverflow) score += 20;
  score += Math.min(15, ((metrics.textReadabilityScore ?? 50) / 100) * 15);
  score += Math.min(10, ((metrics.tapTargetsScore ?? 50) / 100) * 10);
  score += Math.min(10, ((metrics.responsiveImagesScore ?? 50) / 100) * 10);
  score += Math.min(5, ((metrics.navigationScore ?? 50) / 100) * 5);
  return Math.round(score);
}

/**
 * Deterministic Commercial Potential score based on category and market indicators.
 */
export function calculateCommercialPotential(category: string, city: string): number {
  const highValueCategories = [
    'dentist',
    'medical',
    'clinic',
    'lawyer',
    'legal',
    'notary',
    'contractor',
    'roofing',
    'plumbing',
    'hvac',
    'hotel',
    'hospitality',
    'cosmetic',
    'implantology',
    'real estate',
  ];

  const catLower = category.toLowerCase();
  const isHighTicket = highValueCategories.some((kw) => catLower.includes(kw));

  let score = isHighTicket ? 85 : 65;

  // Major economic hubs boost
  const majorCities = ['frankfurt', 'berlin', 'munich', 'hamburg', 'london', 'paris', 'zurich', 'new york'];
  if (majorCities.some((c) => city.toLowerCase().includes(c))) {
    score = Math.min(100, score + 10);
  }

  return score;
}

/**
 * Deterministic Website Health Score & Opportunity Score calculation.
 */
export function evaluateScoresAndOpportunities(params: {
  websiteStatus: 'WEBSITE_FOUND' | 'NO_WEBSITE' | 'WEBSITE_DOWN' | 'BLOCKED_BY_SITE' | 'UNKNOWN';
  metrics: AuditMetrics;
  category: string;
  city: string;
  cms?: string;
}): CalculatedScores {
  const { websiteStatus, metrics, category, city } = params;

  // Special cases: NO_WEBSITE or WEBSITE_DOWN
  if (websiteStatus === 'NO_WEBSITE') {
    const commercialPotential = calculateCommercialPotential(category, city);
    const opportunityScore = Math.min(98, Math.max(85, Math.round(commercialPotential * 0.95 + 10)));
    return {
      mobileScore: 0,
      performanceScore: 0,
      seoScore: 0,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      designScore: 0,
      uxScore: 0,
      conversionScore: 0,
      technologyScore: 0,
      websiteHealthScore: 0,
      opportunityScore,
      categories: ['NO_WEBSITE', 'HIGH_COMMERCIAL_POTENTIAL', 'HIGH_PRIORITY'],
    };
  }

  if (websiteStatus === 'WEBSITE_DOWN') {
    const commercialPotential = calculateCommercialPotential(category, city);
    const opportunityScore = Math.min(96, Math.max(88, Math.round(commercialPotential * 0.92 + 12)));
    return {
      mobileScore: 10,
      performanceScore: 10,
      seoScore: 15,
      accessibilityScore: 10,
      bestPracticesScore: 15,
      designScore: 15,
      uxScore: 10,
      conversionScore: 10,
      technologyScore: 15,
      websiteHealthScore: 12,
      opportunityScore,
      categories: ['WEBSITE_DOWN', 'HIGH_COMMERCIAL_POTENTIAL', 'HIGH_PRIORITY'],
    };
  }

  // Calculate Mobile Score
  const mobileScore = calculateMobileScore(metrics);

  // Calculate Performance Score (based on LCP, FCP, CLS, and response time)
  let performanceScore = 70;
  if (metrics.lcp) {
    if (metrics.lcp > 5000) performanceScore -= 35;
    else if (metrics.lcp > 3000) performanceScore -= 20;
    else if (metrics.lcp < 1800) performanceScore += 15;
  }
  if (metrics.cls && metrics.cls > 0.25) performanceScore -= 15;
  if (metrics.responseDurationMs && metrics.responseDurationMs > 2500) performanceScore -= 15;
  performanceScore = Math.max(10, Math.min(100, Math.round(performanceScore)));

  // Calculate SEO score
  let seoScore = 60;
  if (metrics.metaDescriptionExists) seoScore += 15;
  if (metrics.h1Exists) seoScore += 15;
  if (metrics.sslValid) seoScore += 10;
  seoScore = Math.max(15, Math.min(100, seoScore));

  const accessibilityScore = metrics.viewportMeta ? 65 : 35;
  const bestPracticesScore = metrics.sslValid ? 75 : 35;
  const designScore = !metrics.viewportMeta ? 30 : 60;
  const uxScore = mobileScore < 45 ? 35 : 65;
  const conversionScore = mobileScore < 50 ? 30 : 55;
  const technologyScore = params.cms ? 50 : 60;

  // Website Health Score (Deterministic weighted sum)
  const websiteHealthScore = Math.round(
    performanceScore * 0.2 +
      mobileScore * 0.2 +
      seoScore * 0.15 +
      accessibilityScore * 0.1 +
      bestPracticesScore * 0.1 +
      designScore * 0.1 +
      uxScore * 0.05 +
      conversionScore * 0.05 +
      technologyScore * 0.05
  );

  // Opportunity Score (Section 50):
  // Performance need (20%)
  // Mobile need (20%)
  // Conversion weakness (20%)
  // Design weakness (15%)
  // SEO need (10%)
  // Commercial potential (15%)
  const performanceNeed = (100 - performanceScore) * 0.2;
  const mobileNeed = (100 - mobileScore) * 0.2;
  const conversionWeakness = (100 - conversionScore) * 0.2;
  const designWeakness = (100 - designScore) * 0.15;
  const seoNeed = (100 - seoScore) * 0.1;
  const commercialPotential = calculateCommercialPotential(category, city) * 0.15;

  const opportunityScore = Math.round(
    performanceNeed + mobileNeed + conversionWeakness + designWeakness + seoNeed + commercialPotential
  );

  // Tag categories
  const categories: OpportunityCategory[] = [];
  if (performanceScore < 45) categories.push('VERY_SLOW');
  if (mobileScore < 50) categories.push('NOT_MOBILE');
  if (designScore < 45) categories.push('OUTDATED_DESIGN');
  if (seoScore < 50) categories.push('POOR_SEO');
  if (conversionScore < 45) categories.push('POOR_CONVERSION');
  if (commercialPotential > 11) categories.push('HIGH_COMMERCIAL_POTENTIAL');
  if (opportunityScore >= 75) categories.push('HIGH_PRIORITY');

  return {
    mobileScore,
    performanceScore,
    seoScore,
    accessibilityScore,
    bestPracticesScore,
    designScore,
    uxScore,
    conversionScore,
    technologyScore,
    websiteHealthScore,
    opportunityScore,
    categories,
  };
}
