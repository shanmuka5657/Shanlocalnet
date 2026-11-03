/**
 * LocalNet Geospatial & Dual Distribution Engines
 * 
 * Engine A: ORGANIC ENTERTAINMENT DISTRIBUTION (Creator controlled, supports Worldwide)
 * Engine B: COMMERCIAL ADVERTISEMENT DISTRIBUTION (Strictly capped at max 40 km)
 */

import {
  GeoCoordinates,
  ViewerLocation,
  Post,
  AdCampaign,
  EligibilityResult,
  AudienceScope
} from '../types/index.ts';

/** Earth radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Standard City Presets across India and World */
export interface CityPreset {
  name: string;
  state?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  tagline: string;
}

export const CITY_PRESETS: CityPreset[] = [
  {
    name: 'Kurnool',
    state: 'Andhra Pradesh',
    country: 'India',
    countryCode: 'IN',
    latitude: 15.8281,
    longitude: 78.0373,
    tagline: 'Historical Gateway of Rayalaseema'
  },
  {
    name: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    countryCode: 'IN',
    latitude: 17.3850,
    longitude: 78.4867,
    tagline: 'Cyberabad & Pearl City (~180 km from Kurnool)'
  },
  {
    name: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    latitude: 12.9716,
    longitude: 77.5946,
    tagline: 'Silicon Valley of India (~320 km from Kurnool)'
  },
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    latitude: 19.0760,
    longitude: 72.8777,
    tagline: 'Financial & Entertainment Capital (~630 km from Kurnool)'
  },
  {
    name: 'Delhi',
    state: 'National Capital Region',
    country: 'India',
    countryCode: 'IN',
    latitude: 28.6139,
    longitude: 77.2090,
    tagline: 'National Capital (~1,380 km from Kurnool)'
  },
  {
    name: 'London',
    state: 'Greater London',
    country: 'United Kingdom',
    countryCode: 'GB',
    latitude: 51.5074,
    longitude: -0.1278,
    tagline: 'Global Cultural & Financial Hub (~7,700 km from Kurnool)'
  },
  {
    name: 'New York',
    state: 'New York',
    country: 'United States',
    countryCode: 'US',
    latitude: 40.7128,
    longitude: -74.0060,
    tagline: 'Global Metropolis (~13,300 km from Kurnool)'
  }
];

/**
 * Calculates Great-Circle Haversine distance between two coordinates in kilometers.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  // Return rounded to 1 decimal place (or 2 decimal places for very close < 1km)
  return distance < 1 ? Math.round(distance * 100) / 100 : Math.round(distance * 10) / 10;
}

/**
 * Parses AudienceScope to numerical km (or null for worldwide)
 */
export function parseScopeToKm(scope: AudienceScope, customKm?: number | null): number | null {
  switch (scope) {
    case '1km':
      return 1;
    case '5km':
      return 5;
    case '10km':
      return 10;
    case '20km':
      return 20;
    case '30km':
      return 30;
    case '40km':
      return 40;
    case '100km':
      return 100;
    case '200km':
      return 200;
    case '500km':
      return 500;
    case 'country':
      return 2500; // Typical countrywide threshold
    case 'worldwide':
      return null; // Unlimited
    case 'custom':
      return customKm && customKm > 0 ? customKm : 10;
    default:
      return null;
  }
}

/**
 * Privacy-safe publishing location label
 * NEVER reveals exact GPS coordinates to other users!
 */
export function formatPrivacySafeLocation(
  cityName: string,
  state?: string,
  country?: string,
  distanceKm?: number | null,
  isWorldwide?: boolean
): string {
  if (isWorldwide) {
    return `${cityName} · Worldwide`;
  }
  if (distanceKm !== undefined && distanceKm !== null) {
    if (distanceKm < 1) {
      return `${cityName} · < 1 km away`;
    }
    return `${cityName} · ${distanceKm.toLocaleString()} km away`;
  }
  return cityName;
}

// =========================================================================
// ENGINE A: ORGANIC ENTERTAINMENT DISTRIBUTION
// =========================================================================
export function evaluateOrganicEligibility(
  viewerLocation: ViewerLocation | null,
  post: Post
): EligibilityResult {
  const isWorldwide = post.audienceDistribution.scope === 'worldwide';

  // Rule 1: Worldwide Organic Distribution is ALWAYS ELIGIBLE
  if (isWorldwide) {
    const distanceKm = viewerLocation
      ? calculateHaversineDistance(
          viewerLocation.coords.latitude,
          viewerLocation.coords.longitude,
          post.publishingLocation.latitude,
          post.publishingLocation.longitude
        )
      : 0;

    return {
      isEligible: true,
      engine: 'ORGANIC_ENTERTAINMENT',
      distanceKm,
      allowedRadiusKm: 'worldwide',
      reason: `Creator selected Worldwide distribution. Reach is unrestricted.`,
      privacySafeLocationText: formatPrivacySafeLocation(
        post.publishingLocation.cityName,
        post.publishingLocation.state,
        post.publishingLocation.country,
        distanceKm,
        true
      ),
      ruleCode: 'WORLDWIDE_ORGANIC_ALLOWED'
    };
  }

  // If viewer location is denied or unavailable, location-restricted organic posts cannot be verified
  if (!viewerLocation || viewerLocation.permissionState === 'denied') {
    return {
      isEligible: false,
      engine: 'ORGANIC_ENTERTAINMENT',
      distanceKm: Infinity,
      allowedRadiusKm: post.audienceDistribution.maxRadiusKm ?? 10,
      reason: `This post requires verified viewer location within ${post.audienceDistribution.scope}. Location permission is denied or unavailable.`,
      privacySafeLocationText: post.publishingLocation.cityName,
      ruleCode: 'LOCATION_DENIED_ORGANIC_RESTRICTED'
    };
  }

  // Country scope check
  if (post.audienceDistribution.scope === 'country') {
    const sameCountry =
      viewerLocation.countryCode.toUpperCase() === (post.audienceDistribution.targetCountry || 'IN').toUpperCase();
    const distanceKm = calculateHaversineDistance(
      viewerLocation.coords.latitude,
      viewerLocation.coords.longitude,
      post.publishingLocation.latitude,
      post.publishingLocation.longitude
    );

    return {
      isEligible: sameCountry,
      engine: 'ORGANIC_ENTERTAINMENT',
      distanceKm,
      allowedRadiusKm: 'country',
      reason: sameCountry
        ? `Viewer is in target country (${post.audienceDistribution.targetCountry || 'IN'}).`
        : `Viewer country does not match post country (${post.audienceDistribution.targetCountry || 'IN'}).`,
      privacySafeLocationText: formatPrivacySafeLocation(
        post.publishingLocation.cityName,
        post.publishingLocation.state,
        post.publishingLocation.country,
        distanceKm
      ),
      ruleCode: sameCountry ? 'WITHIN_ORGANIC_RADIUS' : 'EXCEEDS_ORGANIC_RADIUS'
    };
  }

  // Radius scope check (e.g., 1km, 5km, 10km, 20km, 40km, 100km, 200km, 500km, custom)
  const allowedRadius = post.audienceDistribution.maxRadiusKm || parseScopeToKm(post.audienceDistribution.scope) || 10;
  const distanceKm = calculateHaversineDistance(
    viewerLocation.coords.latitude,
    viewerLocation.coords.longitude,
    post.publishingLocation.latitude,
    post.publishingLocation.longitude
  );

  const withinRadius = distanceKm <= allowedRadius;

  return {
    isEligible: withinRadius,
    engine: 'ORGANIC_ENTERTAINMENT',
    distanceKm,
    allowedRadiusKm: allowedRadius,
    reason: withinRadius
      ? `Viewer distance (${distanceKm} km) is within creator's target radius (${allowedRadius} km).`
      : `Viewer distance (${distanceKm} km) exceeds creator's target radius (${allowedRadius} km).`,
    privacySafeLocationText: formatPrivacySafeLocation(
      post.publishingLocation.cityName,
      post.publishingLocation.state,
      post.publishingLocation.country,
      distanceKm
    ),
    ruleCode: withinRadius ? 'WITHIN_ORGANIC_RADIUS' : 'EXCEEDS_ORGANIC_RADIUS'
  };
}

// =========================================================================
// ENGINE B: COMMERCIAL ADVERTISEMENT DISTRIBUTION
// =========================================================================
export const MAXIMUM_COMMERCIAL_RADIUS_KM = 40;

/**
 * Validates whether a commercial campaign satisfies the strict 40 km rule.
 * Server MUST reject any commercial campaign with radius > 40 km!
 */
export function validateCommercialRadius(radiusKm: number): { isValid: boolean; error?: string } {
  if (typeof radiusKm !== 'number' || isNaN(radiusKm) || radiusKm <= 0) {
    return { isValid: false, error: 'Target radius must be a positive number of kilometers.' };
  }
  if (radiusKm > MAXIMUM_COMMERCIAL_RADIUS_KM) {
    return {
      isValid: false,
      error: `Commercial advertisement distribution rule violation: Maximum allowed radius is ${MAXIMUM_COMMERCIAL_RADIUS_KM} km. Provided: ${radiusKm} km. Commercial advertisements cannot reach beyond 40 km.`
    };
  }
  return { isValid: true };
}

/**
 * Evaluates whether a viewer is eligible to receive a commercial advertisement.
 */
export function evaluateCommercialEligibility(
  viewerLocation: ViewerLocation | null,
  ad: AdCampaign
): EligibilityResult {
  // Hard validation of the 40km rule
  if (ad.selectedRadiusKm > MAXIMUM_COMMERCIAL_RADIUS_KM) {
    return {
      isEligible: false,
      engine: 'COMMERCIAL_ADVERTISEMENT',
      distanceKm: Infinity,
      allowedRadiusKm: MAXIMUM_COMMERCIAL_RADIUS_KM,
      reason: `Ad campaign violates policy: radius ${ad.selectedRadiusKm} km exceeds maximum 40 km limit.`,
      privacySafeLocationText: ad.targetCity,
      ruleCode: 'EXCEEDS_COMMERCIAL_RADIUS'
    };
  }

  // Location must be known and verified (or approved city preset)
  if (!viewerLocation || viewerLocation.permissionState === 'denied') {
    return {
      isEligible: false,
      engine: 'COMMERCIAL_ADVERTISEMENT',
      distanceKm: Infinity,
      allowedRadiusKm: ad.selectedRadiusKm,
      reason: `Commercial ads require verified viewer location. Permission is denied or unavailable.`,
      privacySafeLocationText: ad.targetCity,
      ruleCode: 'COMMERCIAL_REQUIRES_LOCATION_VERIFICATION'
    };
  }

  const distanceKm = calculateHaversineDistance(
    viewerLocation.coords.latitude,
    viewerLocation.coords.longitude,
    ad.targetCoordinates.latitude,
    ad.targetCoordinates.longitude
  );

  const withinRadius = distanceKm <= ad.selectedRadiusKm;

  return {
    isEligible: withinRadius,
    engine: 'COMMERCIAL_ADVERTISEMENT',
    distanceKm,
    allowedRadiusKm: ad.selectedRadiusKm,
    reason: withinRadius
      ? `Viewer distance (${distanceKm} km) is within local ad radius (${ad.selectedRadiusKm} km <= 40 km).`
      : `Viewer distance (${distanceKm} km) exceeds local ad radius (${ad.selectedRadiusKm} km).`,
    privacySafeLocationText: `${ad.targetCity} · ${distanceKm} km away`,
    ruleCode: withinRadius ? 'WITHIN_COMMERCIAL_RADIUS' : 'EXCEEDS_COMMERCIAL_RADIUS'
  };
}

// =========================================================================
// COMMERCIAL CONTENT CLASSIFIER & ANTI-BYPASS MODERATION
// =========================================================================
const COMMERCIAL_PROMOTIONAL_KEYWORDS = [
  'buy now',
  'order now',
  'discount',
  'flat 50%',
  'flat 20%',
  'promo code',
  'coupon',
  'limited offer',
  'sale ends',
  'dm to order',
  'shop now',
  'book appointment',
  'sponsored by',
  'paid partnership',
  '#ad',
  '#sponsored',
  '#commercial',
  'call us for booking',
  'whatsapp for price',
  'visit store for discount',
  'special offer on menu',
  'property for sale',
  'flats available'
];

export interface CommercialDetectionResult {
  isCommercialDetected: boolean;
  confidence: number;
  matchedKeywords: string[];
  recommendedAction: 'ALLOW_ORGANIC' | 'FORCE_COMMERCIAL_40KM' | 'REQUIRE_DISCLOSURE';
  noticeMessage?: string;
}

/**
 * Inspects content text and tags to detect undeclared commercial promotions.
 * Prevents creators from bypassing the 40 km commercial cap by uploading ads as organic entertainment!
 */
export function inspectContentForCommercialPromotion(
  title: string,
  description: string,
  tags: string[],
  isDeclaredPaidPromotion: boolean
): CommercialDetectionResult {
  if (isDeclaredPaidPromotion) {
    return {
      isCommercialDetected: true,
      confidence: 1.0,
      matchedKeywords: ['declared_paid_promotion'],
      recommendedAction: 'FORCE_COMMERCIAL_40KM',
      noticeMessage: 'Post contains declared commercial sponsorship. Distribution is capped at 40 km.'
    };
  }

  const combinedText = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const keyword of COMMERCIAL_PROMOTIONAL_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  }

  if (matchedKeywords.length >= 2 || combinedText.includes('#ad') || combinedText.includes('#sponsored')) {
    return {
      isCommercialDetected: true,
      confidence: Math.min(1.0, 0.5 + matchedKeywords.length * 0.2),
      matchedKeywords,
      recommendedAction: 'FORCE_COMMERCIAL_40KM',
      noticeMessage: `Commercial promotion markers detected: [${matchedKeywords.join(', ')}]. Under LocalNet policy, this content is subject to commercial distribution rules (max 40 km).`
    };
  }

  if (matchedKeywords.length === 1) {
    return {
      isCommercialDetected: false,
      confidence: 0.4,
      matchedKeywords,
      recommendedAction: 'REQUIRE_DISCLOSURE',
      noticeMessage: `Potential commercial marker detected: "${matchedKeywords[0]}". Please confirm if this is organic entertainment or commercial promotion.`
    };
  }

  return {
    isCommercialDetected: false,
    confidence: 0,
    matchedKeywords: [],
    recommendedAction: 'ALLOW_ORGANIC'
  };
}
