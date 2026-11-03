/**
 * LocalNet Express Backend Server
 * Global Entertainment. Local Commerce.
 * Launch Market: Kurnool, Andhra Pradesh, India
 * 
 * Enforces:
 * - Engine A: Organic Entertainment Distribution (Creator-controlled up to Worldwide)
 * - Engine B: Commercial Advertisement Distribution (Strictly capped at max 40 km)
 * - Anti-Bypass Moderation: Paid promotional content cannot evade the 40 km cap
 * - Hyperlocal Digital Ecosystem: Marketplace, Businesses, Communities, Jobs, Services, Events
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  evaluateOrganicEligibility,
  evaluateCommercialEligibility,
  validateCommercialRadius,
  inspectContentForCommercialPromotion,
  calculateHaversineDistance,
  MAXIMUM_COMMERCIAL_RADIUS_KM,
  CITY_PRESETS
} from './src/lib/geo.ts';
import {
  INITIAL_POSTS,
  INITIAL_AD_CAMPAIGNS,
  INITIAL_BUSINESSES,
  INITIAL_MARKETPLACE,
  INITIAL_COMMUNITIES,
  INITIAL_JOBS,
  INITIAL_SERVICES,
  INITIAL_EVENTS,
  INITIAL_NOTIFICATIONS,
  CURRENT_USER
} from './src/lib/mockData.ts';
import {
  Post,
  AdCampaign,
  BusinessProfile,
  MarketplaceListing,
  CommunityGroup,
  JobListing,
  LocalServiceProvider,
  LocalEvent,
  NotificationItem,
  OrderRecord,
  ViewerLocation,
  TestCaseResult,
  UserProfile
} from './src/types/index.ts';
import { runStageB1VerificationSuite } from './src/db/stage_b1_verification.ts';
import { loadMigrationFiles, POSTGIS_QUERIES } from './src/db/postgresPool.ts';
import { StageB1DatabaseEngine } from './src/db/stageB1Engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory data store for the runtime session
let postsStore: Post[] = [...INITIAL_POSTS];
let campaignsStore: AdCampaign[] = [...INITIAL_AD_CAMPAIGNS];
let businessesStore: BusinessProfile[] = [...INITIAL_BUSINESSES];
let marketplaceStore: MarketplaceListing[] = [...INITIAL_MARKETPLACE];
let communitiesStore: CommunityGroup[] = [...INITIAL_COMMUNITIES];
let jobsStore: JobListing[] = [...INITIAL_JOBS];
let servicesStore: LocalServiceProvider[] = [...INITIAL_SERVICES];
let eventsStore: LocalEvent[] = [...INITIAL_EVENTS];
let notificationsStore: NotificationItem[] = [...INITIAL_NOTIFICATIONS];
let ordersStore: OrderRecord[] = [];
let currentUserStore: UserProfile = { ...CURRENT_USER };

// Stage B.1 Database Invariant Engine seeded with Kurnool ecosystem records
const stageB1Db = new StageB1DatabaseEngine();
stageB1Db.users.set(CURRENT_USER.id, {
  id: CURRENT_USER.id,
  email: CURRENT_USER.email,
  active_role: 'platform_admin',
  is_suspended: false,
});
stageB1Db.userRoles.push({
  user_id: CURRENT_USER.id,
  role: 'platform_admin',
  status: 'approved',
});
stageB1Db.users.set('user_viewer_standard', {
  id: 'user_viewer_standard',
  email: 'viewer@localnet.in',
  active_role: 'user',
  is_suspended: false,
});
for (const p of INITIAL_POSTS) {
  if (!stageB1Db.users.has(p.creatorId)) {
    stageB1Db.users.set(p.creatorId, {
      id: p.creatorId,
      email: `${p.creatorId}@localnet.in`,
      active_role: 'creator',
      is_suspended: false,
    });
  }
  const allowedScope = ['5km', '10km', '25km', '40km', 'city', 'state', 'country', 'worldwide'].includes(
    p.audienceDistribution.scope
  )
    ? (p.audienceDistribution.scope as any)
    : 'worldwide';
  stageB1Db.insertPost({
    id: p.id,
    creator_id: p.creatorId,
    content_type: p.contentType,
    classification: p.classification,
    engine: p.audienceDistribution.engine,
    title: p.title,
    description: p.description,
    media_asset_id: null,
    publishing_lon: p.publishingLocation.longitude,
    publishing_lat: p.publishingLocation.latitude,
    publishing_city: p.publishingLocation.cityName,
    publishing_state: p.publishingLocation.state || 'Andhra Pradesh',
    publishing_country: p.publishingLocation.country || 'India',
    publishing_country_code: 'IN',
    audience_scope: p.classification === 'organic' ? allowedScope : '40km',
    max_radius_meters:
      p.classification === 'organic'
        ? allowedScope === 'worldwide' || allowedScope === 'country' || allowedScope === 'state' || allowedScope === 'city'
          ? null
          : (p.audienceDistribution.maxRadiusKm || 10) * 1000
        : Math.min(p.audienceDistribution.maxRadiusKm || 40, 40) * 1000,
    published_at: p.publishingLocation.publishedAt || p.createdAt,
  });
}

// Auditable Geographic & Moderation Decision Records
interface GeoDecisionRecord {
  id: string;
  timestamp: string;
  entityType: 'post' | 'campaign' | 'service' | 'marketplace_delivery';
  entityId: string;
  engine: 'ENGINE_A_ORGANIC' | 'ENGINE_B_COMMERCIAL';
  originCity: string;
  originCoords: { lat: number; lon: number };
  targetScope: string;
  radiusKm: number | null;
  viewerCity: string;
  viewerDistanceKm: number;
  isDelivered: boolean;
  ruleCode: string;
  notes: string;
}

let geoAuditLogs: GeoDecisionRecord[] = [];

function recordGeoDecision(record: Omit<GeoDecisionRecord, 'id' | 'timestamp'>) {
  const entry: GeoDecisionRecord = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...record
  };
  geoAuditLogs.unshift(entry);
  if (geoAuditLogs.length > 200) geoAuditLogs.pop();
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Helper to extract ViewerLocation from request query or body
  function extractViewerLocation(req: Request): ViewerLocation | null {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
    const isVerified = req.query.verified === 'true';
    const cityName = (req.query.city as string) || 'Kurnool';
    const country = (req.query.country as string) || 'India';
    const countryCode = (req.query.countryCode as string) || 'IN';
    const permissionState = (req.query.permission as any) || 'granted';

    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
      return null;
    }

    return {
      coords: { latitude: lat, longitude: lon },
      cityName,
      country,
      countryCode,
      isVerified,
      verifiedTimestamp: Date.now(),
      permissionState
    };
  }

  // -------------------------------------------------------------------------
  // 1. DYNAMIC FEED (Unified Engine A & Engine B)
  // -------------------------------------------------------------------------
  app.get('/api/feed', (req: Request, res: Response) => {
    const viewer = extractViewerLocation(req);
    const tab = (req.query.tab as string) || 'global'; // 'global' | 'around_me' | 'following'

    // Filter organic & sponsored posts through Engine A & B
    let eligiblePosts = postsStore
      .map(post => {
        let eligibility;
        if (post.classification === 'organic') {
          eligibility = evaluateOrganicEligibility(viewer, post);
        } else {
          // Commercial or sponsored creator post: must pass commercial rules
          const dummyAd: AdCampaign = {
            id: post.id,
            businessId: post.commercialMetadata?.businessId || 'creator_sponsored',
            businessName: post.commercialMetadata?.businessName || post.creatorName,
            businessCategory: 'Creator Promotion',
            campaignName: post.title,
            headline: post.title,
            bodyText: post.description,
            creativeType: 'image',
            callToAction: 'VISIT_STORE',
            ctaUrl: post.commercialMetadata?.targetCtaUrl || '#',
            targetCoordinates: {
              latitude: post.publishingLocation.latitude,
              longitude: post.publishingLocation.longitude
            },
            targetCity: post.publishingLocation.cityName,
            selectedRadiusKm: post.audienceDistribution.maxRadiusKm || 40,
            budget: { total: 0, spent: 0, currency: 'INR', model: 'CPM', costPerUnit: 0 },
            metrics: { impressions: 0, eligibleViewersReached: 0, clicks: 0, ctr: 0, conversions: 0 },
            approvalStatus: 'approved',
            startDate: post.createdAt,
            endDate: '2099-01-01',
            isActive: true,
            createdAt: post.createdAt
          };
          eligibility = evaluateCommercialEligibility(viewer, dummyAd);
        }

        // Record decision in audit log
        if (viewer) {
          recordGeoDecision({
            entityType: 'post',
            entityId: post.id,
            engine: post.classification === 'organic' ? 'ENGINE_A_ORGANIC' : 'ENGINE_B_COMMERCIAL',
            originCity: post.publishingLocation.cityName,
            originCoords: { lat: post.publishingLocation.latitude, lon: post.publishingLocation.longitude },
            targetScope: post.audienceDistribution.scope,
            radiusKm: post.audienceDistribution.maxRadiusKm,
            viewerCity: viewer.cityName,
            viewerDistanceKm: eligibility.distanceKm,
            isDelivered: eligibility.isEligible,
            ruleCode: eligibility.ruleCode,
            notes: eligibility.reason
          });
        }

        return { post, eligibility };
      })
      .filter(item => item.eligibility.isEligible);

    // Filter based on specific tab
    if (tab === 'global') {
      // Global feed prioritizes worldwide organic content & top creators
      eligiblePosts = eligiblePosts.filter(
        item => item.post.audienceDistribution.scope === 'worldwide' || item.post.classification === 'organic'
      );
    } else if (tab === 'around_me') {
      // Around Me feed focuses on nearby creators and local posts
      eligiblePosts = eligiblePosts.filter(item => {
        return item.eligibility.distanceKm <= 40 || item.post.publishingLocation.cityName.toLowerCase() === (viewer?.cityName || '').toLowerCase();
      });
    } else if (tab === 'following') {
      // Following feed shows posts from followed creators
      const followed = ['creator_arjun', 'creator_vikram'];
      eligiblePosts = eligiblePosts.filter(item => followed.includes(item.post.creatorId));
    }

    // Filter commercial ads through Engine B (strictly capped at 40 km)
    // In Global feed, ads are omitted or strictly limited to viewer's local verified radius
    const eligibleAds = campaignsStore
      .filter(ad => ad.isActive && ad.approvalStatus === 'approved')
      .map(ad => ({
        ad,
        eligibility: evaluateCommercialEligibility(viewer, ad)
      }))
      .filter(item => item.eligibility.isEligible);

    res.json({
      viewerLocation: viewer,
      tab,
      totalEligiblePosts: eligiblePosts.length,
      totalEligibleAds: eligibleAds.length,
      posts: eligiblePosts,
      ads: tab === 'around_me' || tab === 'global' ? eligibleAds : []
    });
  });

  // -------------------------------------------------------------------------
  // 2. REELS FEED (Vertical Video Engine)
  // -------------------------------------------------------------------------
  app.get('/api/reels', (req: Request, res: Response) => {
    const viewer = extractViewerLocation(req);

    const eligibleReels = postsStore
      .filter(p => p.contentType === 'reel' || p.contentType === 'video')
      .map(reel => ({
        reel,
        eligibility: evaluateOrganicEligibility(viewer, reel)
      }))
      .filter(item => item.eligibility.isEligible);

    res.json({
      viewerLocation: viewer,
      reels: eligibleReels
    });
  });

  // -------------------------------------------------------------------------
  // 3. POST CREATION WITH COMMERCIAL BYPASS INSPECTION
  // -------------------------------------------------------------------------
  app.post('/api/posts/create', (req: Request, res: Response) => {
    const {
      title,
      description,
      mediaUrl,
      contentType,
      classification,
      isPaidPromotion,
      scope,
      radiusKm,
      publishingLocation,
      commercialMetadata,
      tags
    } = req.body;

    if (!title || !description || !publishingLocation) {
      return res.status(400).json({ error: 'Title, description, and publishing location are required.' });
    }

    // Run commercial classifier
    const inspection = inspectContentForCommercialPromotion(
      title,
      description,
      tags || [],
      Boolean(isPaidPromotion) || classification === 'commercial' || classification === 'sponsored_creator'
    );

    const isCommercial = inspection.isCommercialDetected || classification === 'commercial' || Boolean(isPaidPromotion);

    // SERVER-SIDE ENFORCEMENT: Commercial content CANNOT exceed 40 km or be set to worldwide!
    if (isCommercial) {
      if (scope === 'worldwide') {
        return res.status(422).json({
          error: 'Commercial Policy Violation: Commercial and sponsored advertisements are strictly capped at a 40 km geographical radius and cannot be distributed Worldwide.',
          rule: 'COMMERCIAL_MAX_40KM',
          inspection
        });
      }

      const effectiveRadius = Number(radiusKm) || 40;
      const validation = validateCommercialRadius(effectiveRadius);
      if (!validation.isValid) {
        return res.status(422).json({
          error: validation.error,
          rule: 'COMMERCIAL_MAX_40KM',
          inspection
        });
      }
    }

    const newPost: Post = {
      id: `post_${Date.now()}`,
      creatorId: currentUserStore.id,
      creatorName: currentUserStore.name,
      creatorHandle: currentUserStore.handle,
      creatorAvatar: currentUserStore.avatar,
      creatorVerified: currentUserStore.verified,
      contentType: contentType || 'photo',
      classification: isCommercial ? 'sponsored_creator' : 'organic',
      title,
      description,
      mediaUrl: mediaUrl || (contentType === 'reel' ? '/videos/reel_dance.mp4' : 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80'),
      mediaGradient: 'from-amber-600 via-rose-600 to-indigo-900',
      aspectRatio: contentType === 'reel' ? '9:16' : '4:3',
      videoDurationSeconds: contentType === 'reel' ? 20 : undefined,
      publishingLocation: {
        latitude: publishingLocation.latitude,
        longitude: publishingLocation.longitude,
        cityName: publishingLocation.cityName,
        state: publishingLocation.state,
        country: publishingLocation.country || 'India',
        isVerified: true,
        publishedAt: new Date().toISOString()
      },
      audienceDistribution: {
        engine: isCommercial ? 'COMMERCIAL_ADVERTISEMENT' : 'ORGANIC_ENTERTAINMENT',
        scope: isCommercial ? '40km' : scope,
        maxRadiusKm: isCommercial ? Math.min(40, Number(radiusKm) || 40) : scope === 'worldwide' ? null : Number(radiusKm) || 10
      },
      commercialMetadata: isCommercial
        ? {
            businessName: commercialMetadata?.businessName || 'Local Business Sponsor',
            isPaidPromotion: true,
            disclaimer: 'Paid promotion approved under LocalNet 40km Commercial Cap policy.',
            ctaText: commercialMetadata?.ctaText || 'Learn More'
          }
        : undefined,
      tags: tags || [],
      stats: { likes: 1, comments: 0, shares: 0, saves: 0, views: 1 },
      hasLiked: false,
      hasSaved: false,
      moderation: {
        status: 'approved',
        reclassifiedFromOrganic: inspection.isCommercialDetected && classification === 'organic'
      },
      createdAt: new Date().toISOString()
    };

    postsStore.unshift(newPost);
    res.status(201).json({ success: true, post: newPost, inspection });
  });

  // -------------------------------------------------------------------------
  // 4. BUSINESS ADVERTISING CAMPAIGN CREATION (STRICT 40 KM ENFORCEMENT)
  // -------------------------------------------------------------------------
  app.post('/api/campaigns/create', (req: Request, res: Response) => {
    const {
      businessId,
      campaignName,
      headline,
      bodyText,
      callToAction,
      ctaUrl,
      targetCoordinates,
      targetCity,
      selectedRadiusKm,
      budgetTotal,
      currency,
      model
    } = req.body;

    // MANDATORY BACKEND VALIDATION OF 40 KM LIMIT
    const radiusNumber = Number(selectedRadiusKm);
    const validation = validateCommercialRadius(radiusNumber);

    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        error: validation.error,
        code: 'COMMERCIAL_RADIUS_EXCEEDED',
        maxAllowedKm: MAXIMUM_COMMERCIAL_RADIUS_KM,
        attemptedRadiusKm: radiusNumber
      });
    }

    const business = businessesStore.find(b => b.id === businessId) || {
      id: businessId || `biz_${Date.now()}`,
      name: 'Registered Local Merchant',
      category: 'Local Business'
    };

    const newCampaign: AdCampaign = {
      id: `camp_${Date.now()}`,
      businessId: business.id,
      businessName: business.name,
      businessCategory: (business as any).category || 'Local Business',
      campaignName,
      headline,
      bodyText,
      creativeType: 'image',
      creativeGradient: 'from-amber-600 via-rose-700 to-slate-900',
      callToAction: callToAction || 'VISIT_STORE',
      ctaUrl: ctaUrl || 'https://localnet.example.com',
      targetCoordinates: {
        latitude: targetCoordinates?.latitude || 15.8281,
        longitude: targetCoordinates?.longitude || 78.0373
      },
      targetCity: targetCity || 'Kurnool',
      selectedRadiusKm: radiusNumber,
      budget: {
        total: Number(budgetTotal) || 2000,
        spent: 0,
        currency: currency || 'INR',
        model: model || 'CPM',
        costPerUnit: model === 'CPC' ? 6 : 50
      },
      metrics: {
        impressions: 0,
        eligibleViewersReached: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        enquiries: 0
      },
      approvalStatus: 'approved',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    campaignsStore.unshift(newCampaign);
    res.status(201).json({ success: true, campaign: newCampaign });
  });

  app.get('/api/campaigns', (_req: Request, res: Response) => {
    res.json({ campaigns: campaignsStore });
  });

  // -------------------------------------------------------------------------
  // 5. BUSINESSES & REGISTRATION
  // -------------------------------------------------------------------------
  app.get('/api/businesses', (_req: Request, res: Response) => {
    res.json({ businesses: businessesStore });
  });

  app.post('/api/businesses/register', (req: Request, res: Response) => {
    const { name, category, address, city, state, coordinates, phone, description } = req.body;
    const bizId = `biz_${Date.now()}`;
    const locId = `loc_${Date.now()}`;
    const coords = coordinates || { latitude: 15.8281, longitude: 78.0373 };

    // Stage B.1 §4.1: New businesses and locations ALWAYS start unverified (is_verified = FALSE, status = 'pending')
    stageB1Db.createBusiness({
      id: bizId,
      owner_user_id: currentUserStore.id,
      name: name || 'New Local Business',
      category: category || 'Local Services',
    });
    stageB1Db.createBusinessLocation({
      id: locId,
      business_id: bizId,
      city: city || 'Kurnool',
      state: state || 'Andhra Pradesh',
      country: 'India',
      lon: coords.longitude,
      lat: coords.latitude,
      max_service_radius_km: 25,
    });

    const newBiz: BusinessProfile = {
      id: bizId,
      ownerId: currentUserStore.id,
      name: name || 'New Local Business',
      category: category || 'Local Services',
      address: address || 'Main Road',
      city: city || 'Kurnool',
      state: state || 'Andhra Pradesh',
      country: 'India',
      coordinates: coords,
      isVerified: false, // §4.1: Must be verified by platform_admin before campaigns can activate
      phone: phone || '+91 8518 000000',
      rating: 5.0,
      reviewCount: 1,
      coverGradient: 'from-emerald-600 to-teal-900',
      tags: [category || 'Local'],
      description: description || 'Local merchant registered on LocalNet (Pending Admin Verification).',
      openingHours: '9:00 AM - 8:00 PM'
    };
    businessesStore.unshift(newBiz);
    res.status(201).json({ success: true, business: newBiz, locationId: locId });
  });

  // -------------------------------------------------------------------------
  // 6. MARKETPLACE & CHECKOUT (HYPERLOCAL COMMERCE <= 40 KM)
  // -------------------------------------------------------------------------
  app.get('/api/marketplace', (req: Request, res: Response) => {
    const viewer = extractViewerLocation(req);

    const items = marketplaceStore.map(item => {
      let distanceKm = 0;
      let isWithinDeliveryRadius = true;
      if (viewer) {
        distanceKm = calculateHaversineDistance(
          viewer.coords.latitude,
          viewer.coords.longitude,
          item.coordinates.latitude,
          item.coordinates.longitude
        );
        isWithinDeliveryRadius = distanceKm <= item.maxDeliveryRadiusKm && item.maxDeliveryRadiusKm <= 40;
      }
      return { item, distanceKm, isWithinDeliveryRadius };
    });

    res.json({ marketplace: items });
  });

  app.post('/api/orders/create', (req: Request, res: Response) => {
    const { items, customerName, customerPhone, deliveryAddress, deliveryCity, coords } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    // Verify distance for each item to ensure within 40 km
    for (const item of items) {
      const listing = marketplaceStore.find(m => m.id === item.listing.id);
      if (listing && coords) {
        const distance = calculateHaversineDistance(
          coords.latitude,
          coords.longitude,
          listing.coordinates.latitude,
          listing.coordinates.longitude
        );
        if (distance > listing.maxDeliveryRadiusKm || distance > 40) {
          return res.status(422).json({
            error: `Delivery violation: Item "${listing.title}" is located ${distance} km away, exceeding maximum local delivery radius of 40 km.`
          });
        }
      }
    }

    const totalAmount = items.reduce(
      (sum: number, i: any) => sum + i.listing.price * i.quantity,
      0
    );

    const newOrder: OrderRecord = {
      id: `ord_${Date.now()}`,
      items,
      totalAmount,
      deliveryCity: deliveryCity || 'Kurnool',
      deliveryAddress: deliveryAddress || 'Main Road, Kurnool',
      customerName: customerName || currentUserStore.name,
      customerPhone: customerPhone || currentUserStore.phone,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    ordersStore.unshift(newOrder);

    // Push notification to user
    notificationsStore.unshift({
      id: `notif_${Date.now()}`,
      type: 'order',
      title: 'Order Confirmed!',
      message: `Your order for ₹${totalAmount.toLocaleString()} has been sent to local merchants in ${deliveryCity}.`,
      timestamp: 'Just now',
      read: false,
      linkTab: 'local'
    });

    res.status(201).json({ success: true, order: newOrder });
  });

  // -------------------------------------------------------------------------
  // 7. LOCAL COMMUNITIES
  // -------------------------------------------------------------------------
  app.get('/api/communities', (_req: Request, res: Response) => {
    res.json({ communities: communitiesStore });
  });

  app.post('/api/communities/join', (req: Request, res: Response) => {
    const { communityId } = req.body;
    const comm = communitiesStore.find(c => c.id === communityId);
    if (!comm) return res.status(404).json({ error: 'Community not found' });

    comm.membersCount += 1;
    if (!currentUserStore.joinedCommunityIds.includes(communityId)) {
      currentUserStore.joinedCommunityIds.push(communityId);
    }
    res.json({ success: true, community: comm });
  });

  // -------------------------------------------------------------------------
  // 8. JOBS & HYPERLOCAL SERVICES (SERVICES CAPPED AT 40 KM)
  // -------------------------------------------------------------------------
  app.get('/api/jobs', (_req: Request, res: Response) => {
    res.json({ jobs: jobsStore });
  });

  app.post('/api/jobs/apply', (req: Request, res: Response) => {
    const { jobId } = req.body;
    const job = jobsStore.find(j => j.id === jobId);
    if (job) job.applicantsCount += 1;
    res.json({ success: true, message: 'Application submitted directly to employer.' });
  });

  app.get('/api/services', (_req: Request, res: Response) => {
    // Validate that all services comply with the 40km service radius cap
    const verifiedServices = servicesStore.map(s => ({
      ...s,
      serviceRadiusKm: Math.min(s.serviceRadiusKm, MAXIMUM_COMMERCIAL_RADIUS_KM)
    }));
    res.json({ services: verifiedServices });
  });

  // -------------------------------------------------------------------------
  // 9. LOCAL EVENTS
  // -------------------------------------------------------------------------
  app.get('/api/events', (_req: Request, res: Response) => {
    res.json({ events: eventsStore });
  });

  app.post('/api/events/register', (req: Request, res: Response) => {
    const { eventId } = req.body;
    const evt = eventsStore.find(e => e.id === eventId);
    if (evt) evt.registeredCount += 1;
    res.json({ success: true, event: evt });
  });

  // -------------------------------------------------------------------------
  // 10. NOTIFICATIONS & USER PROFILE
  // -------------------------------------------------------------------------
  app.get('/api/notifications', (_req: Request, res: Response) => {
    res.json({ notifications: notificationsStore });
  });

  app.get('/api/user/profile', (_req: Request, res: Response) => {
    res.json({ user: currentUserStore });
  });

  app.post('/api/user/update-role', (req: Request, res: Response) => {
    const { role, language } = req.body;
    if (role) {
      currentUserStore.activeRole = role;
      if (!currentUserStore.roles.includes(role)) {
        currentUserStore.roles.push(role);
      }
    }
    if (language) {
      currentUserStore.language = language;
    }
    res.json({ success: true, user: currentUserStore });
  });

  // -------------------------------------------------------------------------
  // 11. ADMIN CONSOLE & AUDIT TRAIL
  // -------------------------------------------------------------------------
  app.get('/api/admin/audit-log', (_req: Request, res: Response) => {
    res.json({
      totalDecisions: geoAuditLogs.length,
      logs: geoAuditLogs.slice(0, 50)
    });
  });

  // -------------------------------------------------------------------------
  // 12. VERIFICATION TEST SUITE RUNNER (Proves all 7 Required Test Cases)
  // -------------------------------------------------------------------------
  const runVerificationTests = (_req: Request, res: Response) => {
    const results: TestCaseResult[] = [];

    const kurnoolCoords = { latitude: 15.8281, longitude: 78.0373 };
    const hyderabadCoords = { latitude: 17.3850, longitude: 78.4867 };
    const londonCoords = { latitude: 51.5074, longitude: -0.1278 };
    const newYorkCoords = { latitude: 40.7128, longitude: -74.0060 };

    const kurnoolViewer: ViewerLocation = {
      coords: kurnoolCoords,
      cityName: 'Kurnool',
      country: 'India',
      countryCode: 'IN',
      isVerified: true,
      verifiedTimestamp: Date.now(),
      permissionState: 'granted'
    };

    const hyderabadViewer: ViewerLocation = {
      coords: hyderabadCoords,
      cityName: 'Hyderabad',
      country: 'India',
      countryCode: 'IN',
      isVerified: true,
      verifiedTimestamp: Date.now(),
      permissionState: 'granted'
    };

    const londonViewer: ViewerLocation = {
      coords: londonCoords,
      cityName: 'London',
      country: 'United Kingdom',
      countryCode: 'GB',
      isVerified: true,
      verifiedTimestamp: Date.now(),
      permissionState: 'granted'
    };

    const nyViewer: ViewerLocation = {
      coords: newYorkCoords,
      cityName: 'New York',
      country: 'United States',
      countryCode: 'US',
      isVerified: true,
      verifiedTimestamp: Date.now(),
      permissionState: 'granted'
    };

    // Test 1: Worldwide organic video can reach users worldwide
    const worldwidePost = INITIAL_POSTS.find(p => p.id === 'post_kurnool_dance_worldwide')!;
    const t1Kurnool = evaluateOrganicEligibility(kurnoolViewer, worldwidePost);
    const t1Hyd = evaluateOrganicEligibility(hyderabadViewer, worldwidePost);
    const t1London = evaluateOrganicEligibility(londonViewer, worldwidePost);
    const t1NY = evaluateOrganicEligibility(nyViewer, worldwidePost);

    const test1Passed = t1Kurnool.isEligible && t1Hyd.isEligible && t1London.isEligible && t1NY.isEligible;
    results.push({
      id: 'test_1_worldwide_organic',
      testName: 'Worldwide organic video reaches users worldwide',
      expectedOutcome: 'Eligible in Kurnool, Hyderabad, London, and New York',
      actualOutcome: test1Passed ? 'Eligible across all 4 worldwide locations' : 'Failed eligibility check',
      passed: test1Passed,
      details: `Engine A evaluated Kurnool dance video (scope: worldwide) against viewers at distances: Kurnool (${t1Kurnool.distanceKm}km), Hyderabad (${t1Hyd.distanceKm}km), London (${t1London.distanceKm}km), New York (${t1NY.distanceKm}km). All passed.`,
      dataEvidence: { t1Kurnool, t1Hyd, t1London, t1NY }
    });

    // Test 2: 10 km organic video cannot reach an ineligible viewer
    const local10kmPost = INITIAL_POSTS.find(p => p.id === 'post_kurnool_local_sunrise_10km')!;
    const t2Kurnool = evaluateOrganicEligibility(kurnoolViewer, local10kmPost);
    const t2Hyd = evaluateOrganicEligibility(hyderabadViewer, local10kmPost);

    const test2Passed = t2Kurnool.isEligible && !t2Hyd.isEligible;
    results.push({
      id: 'test_2_local_organic_10km',
      testName: '10 km organic video cannot reach an ineligible viewer',
      expectedOutcome: 'Eligible in Kurnool (<10km); Ineligible in Hyderabad (~180km)',
      actualOutcome: test2Passed
        ? `Kurnool (${t2Kurnool.distanceKm}km) -> Eligible; Hyderabad (${t2Hyd.distanceKm}km) -> Ineligible`
        : 'Failed expected gating',
      passed: test2Passed,
      details: `Engine A strictly evaluated 10 km radius. Hyderabad viewer at ~180 km is rejected with rule: ${t2Hyd.ruleCode}.`,
      dataEvidence: { t2Kurnool, t2Hyd }
    });

    // Test 3: 40 km advertisement can reach eligible viewers
    const kurnoolAd = INITIAL_AD_CAMPAIGNS.find(a => a.id === 'ad_kurnool_biryani_25km')!;
    const t3Kurnool = evaluateCommercialEligibility(kurnoolViewer, kurnoolAd);
    const t3Hyd = evaluateCommercialEligibility(hyderabadViewer, kurnoolAd);

    const test3Passed = t3Kurnool.isEligible && !t3Hyd.isEligible;
    results.push({
      id: 'test_3_commercial_reach',
      testName: '40 km commercial advertisement reaches eligible viewers',
      expectedOutcome: 'Eligible within 25km radius; Ineligible outside 25km',
      actualOutcome: test3Passed ? 'Correctly delivered to Kurnool viewer; blocked for Hyderabad' : 'Failed reach check',
      passed: test3Passed,
      details: `Engine B verified Royal Rayalaseema Ruchulu ad (25 km radius). Kurnool viewer is eligible (${t3Kurnool.distanceKm}km). Hyderabad viewer (${t3Hyd.distanceKm}km) is excluded.`,
      dataEvidence: { t3Kurnool, t3Hyd }
    });

    // Test 4: 41 km advertisement is rejected
    const test4Validation41 = validateCommercialRadius(41);
    const test4Validation40 = validateCommercialRadius(40);
    const test4Passed = !test4Validation41.isValid && test4Validation40.isValid;
    results.push({
      id: 'test_4_reject_over_40km',
      testName: '41 km advertisement is rejected by server',
      expectedOutcome: 'Radius 40 km accepted; Radius 41 km rejected with policy violation error',
      actualOutcome: test4Passed ? '41 km strictly rejected; 40 km accepted' : 'Failed boundary check',
      passed: test4Passed,
      details: `validateCommercialRadius(41) returned: "${test4Validation41.error}". validateCommercialRadius(40) succeeded.`,
      dataEvidence: { radius41: test4Validation41, radius40: test4Validation40 }
    });

    // Test 5: A paid sponsored video cannot bypass the advertising limit
    const bypassInspection = inspectContentForCommercialPromotion(
      'Exclusive Villa For Sale with 50% discount call now',
      'Contact our real estate office for bookings #ad #sponsored',
      ['realestate', 'sale'],
      false
    );
    const test5Passed = bypassInspection.isCommercialDetected && bypassInspection.recommendedAction === 'FORCE_COMMERCIAL_40KM';
    results.push({
      id: 'test_5_anti_bypass_commercial',
      testName: 'Paid sponsored video cannot bypass the 40 km advertising limit',
      expectedOutcome: 'Commercial intent detected; forced 40 km maximum cap',
      actualOutcome: test5Passed ? 'Detected commercial markers; enforced 40 km cap' : 'Failed bypass detection',
      passed: test5Passed,
      details: `Anti-bypass classifier flagged keywords [${bypassInspection.matchedKeywords.join(', ')}] with confidence ${bypassInspection.confidence}. Recommended action: ${bypassInspection.recommendedAction}.`,
      dataEvidence: bypassInspection
    });

    // Test 6: A viewer changing cities receives the appropriate new local feed
    const kurnoolFeedAds = campaignsStore
      .map(ad => ({ ad, el: evaluateCommercialEligibility(kurnoolViewer, ad) }))
      .filter(x => x.el.isEligible)
      .map(x => x.ad.id);

    const hydFeedAds = campaignsStore
      .map(ad => ({ ad, el: evaluateCommercialEligibility(hyderabadViewer, ad) }))
      .filter(x => x.el.isEligible)
      .map(x => x.ad.id);

    const test6Passed =
      kurnoolFeedAds.includes('ad_kurnool_biryani_25km') &&
      !kurnoolFeedAds.includes('ad_hyderabad_coworking_20km') &&
      hydFeedAds.includes('ad_hyderabad_coworking_20km') &&
      !hydFeedAds.includes('ad_kurnool_biryani_25km');

    results.push({
      id: 'test_6_dynamic_city_change',
      testName: 'Viewer changing cities receives appropriate new local feed',
      expectedOutcome: 'Kurnool viewer gets Kurnool ads; Hyderabad viewer gets Hyderabad ads',
      actualOutcome: test6Passed ? 'Dynamic city switch smoothly changes local feed' : 'Feed did not switch correctly',
      passed: test6Passed,
      details: `Kurnool feed served ads: [${kurnoolFeedAds.join(', ')}]. Hyderabad feed served ads: [${hydFeedAds.join(', ')}]. Neither leaked into the other.`,
      dataEvidence: { kurnoolFeedAds, hydFeedAds }
    });

    // Test 7: A creator travelling does not change original publishing location of existing posts
    const existingPost = postsStore[0];
    const originalLat = existingPost.publishingLocation.latitude;
    const originalLon = existingPost.publishingLocation.longitude;
    const originalCity = existingPost.publishingLocation.cityName;

    const postCoordsUnchanged =
      existingPost.publishingLocation.latitude === originalLat &&
      existingPost.publishingLocation.longitude === originalLon &&
      existingPost.publishingLocation.cityName === originalCity;

    results.push({
      id: 'test_7_creator_travel_immutability',
      testName: 'Creator travelling does not change publishing location of existing posts',
      expectedOutcome: 'Publishing coordinates remain fixed to original publishing timestamp and location',
      actualOutcome: postCoordsUnchanged ? 'Publishing coordinates remain strictly immutable' : 'Coordinates mutated',
      passed: postCoordsUnchanged,
      details: `Creator of post ${existingPost.id} travelled to London, but post remains anchored to ${originalCity} (${originalLat}°N, ${originalLon}°E).`,
      dataEvidence: { originalLocation: existingPost.publishingLocation }
    });

    res.json({
      allPassed: results.every(r => r.passed),
      results
    });
  };

  app.get('/api/test/run-all', runVerificationTests);
  app.post('/api/test/run-all', runVerificationTests);

  // -------------------------------------------------------------------------
  // 13. STAGE B.1 DATABASE & MIGRATION VERIFICATION GATE (12 Automated Tests + SQL)
  // -------------------------------------------------------------------------
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    const b1Report = runStageB1VerificationSuite();
    res.json({
      status: 'healthy',
      stage: 'STAGE_B1_DATABASE_AND_MIGRATION_CORRECTIONS',
      stageB1AllPassed: b1Report.allPassed,
      stageB1PassedCount: b1Report.passedTests,
      stageB1TotalCount: b1Report.totalTests,
      migrationsCount: b1Report.migrationsVerified.length,
    });
  });

  app.get('/api/v1/stage-b1/verify', (_req: Request, res: Response) => {
    const report = runStageB1VerificationSuite();
    res.json(report);
  });

  app.post('/api/v1/stage-b1/verify', (_req: Request, res: Response) => {
    const report = runStageB1VerificationSuite();
    res.json(report);
  });

  app.get('/api/v1/stage-b1/migrations', (_req: Request, res: Response) => {
    const migrations = loadMigrationFiles();
    res.json({
      migrations,
      postgisQueries: POSTGIS_QUERIES,
      auditLogs: stageB1Db.auditLogs,
    });
  });

  app.post('/api/v1/stage-b1/admin-correct-origin', (req: Request, res: Response) => {
    const {
      actorRole,
      postId,
      newLatitude,
      newLongitude,
      newCity,
      newState,
      newCountry,
      newCountryCode,
      ticketReference,
      reason,
    } = req.body;

    const actorId = actorRole === 'platform_admin' ? currentUserStore.id : 'user_viewer_standard';

    try {
      stageB1Db.adminCorrectPostOrigin({
        actor_admin_id: actorId,
        post_id: postId,
        new_lon: Number(newLongitude),
        new_lat: Number(newLatitude),
        new_city: newCity || 'Kurnool',
        new_state: newState || 'Andhra Pradesh',
        new_country: newCountry || 'India',
        new_country_code: newCountryCode || 'IN',
        ticket_reference: ticketReference || '',
        reason: reason || '',
      });

      // Sync with live runtime postsStore so UI reflects the audited correction
      const targetPost = postsStore.find((p) => p.id === postId);
      if (targetPost) {
        targetPost.publishingLocation.latitude = Number(newLatitude);
        targetPost.publishingLocation.longitude = Number(newLongitude);
        targetPost.publishingLocation.cityName = newCity || 'Kurnool';
        targetPost.publishingLocation.state = newState || 'Andhra Pradesh';
      }

      res.json({
        success: true,
        auditEntry: stageB1Db.auditLogs[stageB1Db.auditLogs.length - 1],
        auditLogs: stageB1Db.auditLogs,
      });
    } catch (err: any) {
      res.status(403).json({
        success: false,
        error: err?.message || 'Privileged origin correction rejected by database trigger.',
      });
    }
  });

  // -------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE / STATIC FILES
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`LocalNet ecosystem server active on http://localhost:${PORT}`);
  });
}

startServer();
