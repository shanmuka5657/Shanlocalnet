/**
 * LocalNet Core Type Definitions
 * Global Entertainment. Local Commerce.
 * Launch Market: Kurnool, Andhra Pradesh, India
 */

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // In meters
  altitude?: number | null;
}

export type PermissionState = 'granted' | 'prompt' | 'denied';

export type SupportedLanguage = 'en' | 'te' | 'hi';

export type UserRole =
  | 'viewer'
  | 'creator'
  | 'business_owner'
  | 'merchant'
  | 'service_provider'
  | 'community_admin';

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  country: string;
  bio: string;
  roles: UserRole[];
  activeRole: UserRole;
  language: SupportedLanguage;
  verified: boolean;
  followersCount: number;
  followingCount: number;
  savedPostIds: string[];
  joinedCommunityIds: string[];
}

export interface ViewerLocation {
  coords: GeoCoordinates;
  cityName: string;
  stateName?: string;
  country: string;
  countryCode: string;
  isVerified: boolean; // Verified by hardware GPS vs approximate/manual preset
  verifiedTimestamp: number;
  permissionState: PermissionState;
}

export type AudienceScope =
  | '1km'
  | '5km'
  | '10km'
  | '20km'
  | '30km'
  | '40km'
  | '100km'
  | '200km'
  | '500km'
  | 'country'
  | 'worldwide'
  | 'custom';

export type DistributionEngineType = 'ORGANIC_ENTERTAINMENT' | 'COMMERCIAL_ADVERTISEMENT';

export type PostClassification = 'organic' | 'commercial' | 'sponsored_creator';

export interface PublishingLocation {
  latitude: number;
  longitude: number;
  cityName: string;
  state?: string;
  country: string;
  isVerified: boolean;
  publishedAt: string;
}

export interface AudienceDistribution {
  engine: DistributionEngineType;
  scope: AudienceScope;
  maxRadiusKm: number | null; // null for worldwide
  targetCountry?: string;
}

export interface CommercialMetadata {
  businessId?: string;
  businessName?: string;
  isPaidPromotion: boolean;
  disclaimer: string;
  targetCtaUrl?: string;
  ctaText?: string;
  campaignId?: string;
}

export interface PostModeration {
  status: 'approved' | 'flagged' | 'under_review';
  flagReason?: string;
  detectedCommercialKeywords?: string[];
  reclassifiedFromOrganic?: boolean;
}

export interface MediaAsset {
  id: string;
  ownerUserId: string;
  bucketCategory: 'avatars' | 'posts_images' | 'videos_original' | 'videos_processed' | 'business_media' | 'temp_uploads';
  s3Key: string;
  storageProvider: 'local' | 's3';
  originalFilename?: string;
  cloudfrontUrl?: string;
  mimeType: string;
  magicBytesVerified: boolean;
  sizeBytes: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface AudioTrackMetadata {
  id: string;
  title: string;
  artist: string;
  category: 'trending' | 'regional' | 'folk' | 'acoustic' | 'ambient';
  audioUrl?: string;
  durationSeconds?: number;
  coverUrl?: string;
  useCount?: number;
}

export interface Post {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string;
  creatorVerified: boolean;
  contentType: 'video' | 'reel' | 'photo' | 'multi_photo' | 'text' | 'story' | 'community_update';
  classification: PostClassification;
  title: string;
  description: string;
  mediaAssetId?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  mediaGradient?: string;
  aspectRatio?: '9:16' | '1:1' | '4:3' | '16:9';
  videoDurationSeconds?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  audioTrack?: AudioTrackMetadata;
  publishingLocation: PublishingLocation;
  audienceDistribution: AudienceDistribution;
  commercialMetadata?: CommercialMetadata;
  tags: string[];
  stats: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    views: number;
  };
  hasLiked?: boolean;
  hasSaved?: boolean;
  moderation: PostModeration;
  commentsList?: any[];
  createdAt: string;
}

export interface AdCampaign {
  id: string;
  businessId: string;
  businessName: string;
  businessCategory: string;
  campaignName: string;
  headline: string;
  bodyText: string;
  creativeUrl?: string;
  creativeGradient?: string;
  creativeType: 'video' | 'image';
  callToAction: 'VISIT_STORE' | 'ORDER_ONLINE' | 'BOOK_NOW' | 'CALL_BUSINESS' | 'VIEW_DEAL';
  ctaUrl: string;
  targetCoordinates: GeoCoordinates;
  targetCity: string;
  selectedRadiusKm: number; // MUST BE <= 40 km strictly enforced
  budget: {
    total: number;
    spent: number;
    currency: 'INR' | 'USD';
    model: 'CPM' | 'CPC';
    costPerUnit: number;
  };
  metrics: {
    impressions: number;
    eligibleViewersReached: number;
    clicks: number;
    ctr: number;
    conversions: number;
    enquiries?: number;
  };
  approvalStatus: 'approved' | 'pending' | 'rejected';
  rejectionReason?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface BusinessProfile {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  coordinates: GeoCoordinates;
  isVerified: boolean;
  phone: string;
  rating: number;
  reviewCount: number;
  coverGradient: string;
  tags: string[];
  description: string;
  openingHours: string;
}

export interface MarketplaceListing {
  id: string;
  businessId?: string;
  sellerName: string;
  sellerVerified: boolean;
  title: string;
  price: number;
  currency: 'INR' | 'USD';
  category: string;
  description: string;
  coordinates: GeoCoordinates;
  cityName: string;
  maxDeliveryRadiusKm: number; // Max 40 km for local commerce delivery
  coverGradient: string;
  condition: 'new' | 'artisan' | 'used';
  contactPhone: string;
  inStock: boolean;
  rating?: number;
}

export interface CartItem {
  listing: MarketplaceListing;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  items: CartItem[];
  totalAmount: number;
  deliveryCity: string;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
  status: 'confirmed' | 'dispatched' | 'out_for_delivery' | 'delivered';
  createdAt: string;
}

export interface CommunityGroup {
  id: string;
  name: string;
  category: string;
  description: string;
  city: string;
  isPrivate: boolean;
  membersCount: number;
  iconName: string;
  coverGradient: string;
  adminName: string;
  recentPostsCount: number;
  tags: string[];
}

export interface JobListing {
  id: string;
  title: string;
  companyName: string;
  city: string;
  category: string;
  jobType: 'Full-time' | 'Part-time' | 'Gig / Local';
  salaryRange: string;
  description: string;
  requirements: string[];
  contactPhone: string;
  postedDate: string;
  applicantsCount: number;
}

export interface LocalServiceProvider {
  id: string;
  name: string;
  serviceCategory: string;
  city: string;
  coordinates: GeoCoordinates;
  serviceRadiusKm: number; // Capped <= 40 km
  rating: number;
  reviewCount: number;
  phone: string;
  experienceYears: number;
  hourlyRate?: string;
  description: string;
  verified: boolean;
}

export interface LocalEvent {
  id: string;
  title: string;
  organizer: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  coordinates: GeoCoordinates;
  description: string;
  registeredCount: number;
  isFree: boolean;
  price?: number;
  coverGradient: string;
}

export interface EligibilityResult {
  isEligible: boolean;
  engine: DistributionEngineType;
  distanceKm: number;
  allowedRadiusKm: number | 'worldwide' | 'country';
  reason: string;
  privacySafeLocationText: string;
  ruleCode:
    | 'WORLDWIDE_ORGANIC_ALLOWED'
    | 'WITHIN_ORGANIC_RADIUS'
    | 'EXCEEDS_ORGANIC_RADIUS'
    | 'WITHIN_COMMERCIAL_RADIUS'
    | 'EXCEEDS_COMMERCIAL_RADIUS'
    | 'COMMERCIAL_REQUIRES_LOCATION_VERIFICATION'
    | 'LOCATION_DENIED_ORGANIC_RESTRICTED';
}

export interface TestCaseResult {
  id: string;
  testName: string;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
  details: string;
  dataEvidence: Record<string, any>;
}

export interface NotificationItem {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'order' | 'campaign' | 'community' | 'geo_alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  linkTab?: string;
}

export type VehicleType = 'bike' | 'auto' | 'car' | 'suv' | 'van';

export interface RideListing {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatar: string;
  driverRating: number;
  driverTotalRides: number;
  driverVerified: boolean;

  fromCity: string;
  fromArea: string;
  fromLat: number;
  fromLon: number;

  toCity: string;
  toArea: string;
  toLat: number;
  toLon: number;

  waypoints: string[];

  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:MM (24h)
  estimatedDuration: string; // e.g. "4h 30m"
  distanceKm: number;

  totalSeats: number;
  availableSeats: number;
  pricePerSeat: number; // INR

  vehicleType: VehicleType;
  vehicleModel: string;
  vehicleColor: string;
  vehicleNumber?: string;

  preferences: string[]; // e.g. ["No smoking", "Women only", "Luggage OK"]
  notes: string;

  status: 'active' | 'full' | 'completed' | 'cancelled';
  createdAt: string;
  bookedSeats: number;
}
