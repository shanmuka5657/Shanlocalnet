/**
 * LocalNet Ecosystem Seed Dataset
 * Launch Market: Kurnool, Andhra Pradesh, India
 */

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
  UserProfile
} from '../types/index.ts';

export const CURRENT_USER: UserProfile = {
  id: 'current_user_1',
  name: 'Arjun Rayalaseema',
  handle: '@arjun_grooves',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  phone: '+91 94401 23456',
  email: 'arjun@localnet.in',
  city: 'Kurnool',
  state: 'Andhra Pradesh',
  country: 'India',
  bio: 'Choreographer, cultural creator & proud Kurnool local. Sharing our regional heritage globally and supporting local commerce.',
  roles: ['viewer', 'creator', 'merchant'],
  activeRole: 'creator',
  language: 'en',
  verified: true,
  followersCount: 24500,
  followingCount: 318,
  savedPostIds: ['post_kurnool_dance_worldwide'],
  joinedCommunityIds: ['comm_kurnool_city', 'comm_rayalaseema_farmers']
};

export const INITIAL_POSTS: Post[] = [
  {
    id: 'post_kurnool_dance_worldwide',
    creatorId: 'creator_arjun',
    creatorName: 'Arjun Rayalaseema',
    creatorHandle: '@arjun_grooves',
    creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    creatorVerified: true,
    contentType: 'reel',
    classification: 'organic',
    title: 'Kurnool Heritage Freestyle Dance',
    description: 'Blending South Indian folk steps with hip-hop right in front of the historic fort! Filmed at dusk in Kurnool. Enjoy the rhythm anywhere in the world! 🎵🔥 #Dance #Rayalaseema #ViralReel #IndianDance',
    mediaUrl: '/videos/reel_dance.mp4',
    mediaThumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    mediaGradient: 'from-amber-600 via-rose-600 to-indigo-900',
    aspectRatio: '9:16',
    videoDurationSeconds: 24,
    publishingLocation: {
      latitude: 15.8281,
      longitude: 78.0373,
      cityName: 'Kurnool',
      state: 'Andhra Pradesh',
      country: 'India',
      isVerified: true,
      publishedAt: '2026-11-01T10:30:00Z'
    },
    audienceDistribution: {
      engine: 'ORGANIC_ENTERTAINMENT',
      scope: 'worldwide',
      maxRadiusKm: null
    },
    tags: ['dance', 'freestyle', 'kurnool', 'worldwide', 'hiphop'],
    stats: {
      likes: 14250,
      comments: 632,
      shares: 3120,
      saves: 890,
      views: 98500
    },
    hasLiked: false,
    hasSaved: false,
    moderation: { status: 'approved' },
    createdAt: '2026-11-01T10:30:00Z'
  },
  {
    id: 'post_kurnool_local_sunrise_10km',
    creatorId: 'creator_sneha',
    creatorName: 'Sneha Reddy',
    creatorHandle: '@sneha_explores',
    creatorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    creatorVerified: false,
    contentType: 'photo',
    classification: 'organic',
    title: 'Secret Morning Viewpoint near Tungabhadra River',
    description: 'Only true Kurnool locals know about this quiet stone bend near the riverbank at 6 AM. Let us keep our local riverbank clean and quiet. 🌅🌿 #KurnoolLocals #MorningWalk #HiddenGem',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    mediaGradient: 'from-emerald-700 via-teal-800 to-slate-900',
    aspectRatio: '4:3',
    publishingLocation: {
      latitude: 15.8281,
      longitude: 78.0373,
      cityName: 'Kurnool',
      state: 'Andhra Pradesh',
      country: 'India',
      isVerified: true,
      publishedAt: '2026-11-02T06:15:00Z'
    },
    audienceDistribution: {
      engine: 'ORGANIC_ENTERTAINMENT',
      scope: '10km',
      maxRadiusKm: 10
    },
    tags: ['kurnool', 'local', 'sunrise', 'community'],
    stats: {
      likes: 340,
      comments: 48,
      shares: 19,
      saves: 52,
      views: 1250
    },
    hasLiked: false,
    hasSaved: false,
    moderation: { status: 'approved' },
    createdAt: '2026-11-02T06:15:00Z'
  },
  {
    id: 'post_hyderabad_tech_comedy_worldwide',
    creatorId: 'creator_vikram',
    creatorName: 'Vikram Joshi',
    creatorHandle: '@vikram_standup',
    creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    creatorVerified: true,
    contentType: 'reel',
    classification: 'organic',
    title: 'When your code runs fine on localhost but fails in production 😂',
    description: 'Every software developer will feel this in their bones! Filmed in Hyderabad Hitec City. Sent out to developers everywhere on Earth! 💻☕ #Comedy #Developers #TechLife #ReelHumor',
    mediaUrl: '/videos/reel_tech.mp4',
    mediaThumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
    mediaGradient: 'from-blue-600 via-violet-700 to-purple-900',
    aspectRatio: '9:16',
    videoDurationSeconds: 18,
    publishingLocation: {
      latitude: 17.3850,
      longitude: 78.4867,
      cityName: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      isVerified: true,
      publishedAt: '2026-11-02T14:00:00Z'
    },
    audienceDistribution: {
      engine: 'ORGANIC_ENTERTAINMENT',
      scope: 'worldwide',
      maxRadiusKm: null
    },
    tags: ['comedy', 'tech', 'humor', 'worldwide', 'developers'],
    stats: {
      likes: 28400,
      comments: 1120,
      shares: 7400,
      saves: 3400,
      views: 245000
    },
    hasLiked: false,
    hasSaved: false,
    moderation: { status: 'approved' },
    createdAt: '2026-11-02T14:00:00Z'
  },
  {
    id: 'post_kurnool_handicrafts_sponsored_40km',
    creatorId: 'creator_kavitha',
    creatorName: 'Kavitha Handlooms',
    creatorHandle: '@kavitha_silks',
    creatorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    creatorVerified: true,
    contentType: 'photo',
    classification: 'sponsored_creator',
    title: 'Pure Gadwal & Pochampally Handloom Sarees Exhibition',
    description: 'Sponsored promotion in association with Rayalaseema Weavers Cooperative. Handcrafted weaves directly from local artisan families. Capped at 30km radius! 🥻🧵 #Handmade #Artisans #Sponsored #ShopLocal',
    mediaUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=80',
    mediaGradient: 'from-pink-800 via-rose-900 to-purple-950',
    aspectRatio: '4:3',
    publishingLocation: {
      latitude: 15.8281,
      longitude: 78.0373,
      cityName: 'Kurnool',
      state: 'Andhra Pradesh',
      country: 'India',
      isVerified: true,
      publishedAt: '2026-11-02T11:00:00Z'
    },
    audienceDistribution: {
      engine: 'COMMERCIAL_ADVERTISEMENT',
      scope: '30km',
      maxRadiusKm: 30
    },
    commercialMetadata: {
      businessId: 'biz_kurnool_handloom',
      businessName: 'Rayalaseema Weavers Hub',
      isPaidPromotion: true,
      disclaimer: 'Paid promotion approved under LocalNet 40km Commercial Cap policy.',
      targetCtaUrl: 'tel:+918518223344',
      ctaText: 'Visit Artisan Store'
    },
    tags: ['handloom', 'saree', 'kurnool', 'sponsored', 'artisan'],
    stats: {
      likes: 580,
      comments: 64,
      shares: 92,
      saves: 130,
      views: 4800
    },
    hasLiked: false,
    hasSaved: false,
    moderation: {
      status: 'approved',
      reclassifiedFromOrganic: false
    },
    createdAt: '2026-11-02T11:00:00Z'
  },
  {
    id: 'post_london_acoustic_worldwide',
    creatorId: 'creator_charlotte',
    creatorName: 'Charlotte Hughes',
    creatorHandle: '@charlotte_acoustic',
    creatorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    creatorVerified: true,
    contentType: 'reel',
    classification: 'organic',
    title: 'Rainy evening acoustic improv on the Thames 🎸🌧️',
    description: 'Writing some peaceful melodies while the London drizzle hits the windowpane. Sending warmth across continents! ✨ #Acoustic #Guitar #London #OriginalMusic',
    mediaUrl: '/videos/reel_music.mp4',
    mediaThumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    mediaGradient: 'from-slate-700 via-indigo-900 to-stone-900',
    aspectRatio: '9:16',
    videoDurationSeconds: 22,
    publishingLocation: {
      latitude: 51.5074,
      longitude: -0.1278,
      cityName: 'London',
      state: 'Greater London',
      country: 'United Kingdom',
      isVerified: true,
      publishedAt: '2026-11-02T18:00:00Z'
    },
    audienceDistribution: {
      engine: 'ORGANIC_ENTERTAINMENT',
      scope: 'worldwide',
      maxRadiusKm: null
    },
    tags: ['music', 'guitar', 'worldwide', 'london', 'acoustic'],
    stats: {
      likes: 31200,
      comments: 940,
      shares: 4800,
      saves: 2900,
      views: 182000
    },
    hasLiked: false,
    hasSaved: false,
    moderation: { status: 'approved' },
    createdAt: '2026-11-02T18:00:00Z'
  }
];

export const INITIAL_AD_CAMPAIGNS: AdCampaign[] = [
  {
    id: 'ad_kurnool_biryani_25km',
    businessId: 'biz_kurnool_biryani',
    businessName: 'Royal Rayalaseema Ruchulu',
    businessCategory: 'Restaurant & Dining',
    campaignName: 'Weekend Clay Pot Biryani Special',
    headline: 'Authentic Kurnool Dum Biryani & Gongura Mutton',
    bodyText: 'Special 20% discount on family clay pots this Friday to Sunday. Wood-fired dum cooking with heirloom spices. Available exclusively for dine-in & takeaway in Kurnool.',
    creativeType: 'image',
    creativeGradient: 'from-amber-600 via-red-700 to-stone-950',
    callToAction: 'VISIT_STORE',
    ctaUrl: 'https://maps.google.com/?q=Kurnool+Biryani',
    targetCoordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    targetCity: 'Kurnool',
    selectedRadiusKm: 25, // STRICT <= 40 km
    budget: {
      total: 5000,
      spent: 1850,
      currency: 'INR',
      model: 'CPM',
      costPerUnit: 60
    },
    metrics: {
      impressions: 30800,
      eligibleViewersReached: 12400,
      clicks: 842,
      ctr: 2.73,
      conversions: 185,
      enquiries: 64
    },
    approvalStatus: 'approved',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-11-15T23:59:59Z',
    isActive: true,
    createdAt: '2026-10-30T10:00:00Z'
  },
  {
    id: 'ad_kurnool_dental_clinic_15km',
    businessId: 'biz_kurnool_health',
    businessName: 'Kurnool Smile Care & Dental Hospital',
    businessCategory: 'Hospitals & Healthcare',
    campaignName: 'Free Preventive Dental Checkup Camp',
    headline: 'Gentle Advanced Dental Care for Your Entire Family',
    bodyText: 'Book your free smile scan and consultation this month. Certified pediatric and orthodontic specialists located near Bellary Chowrasta.',
    creativeType: 'image',
    creativeGradient: 'from-cyan-600 via-blue-700 to-slate-900',
    callToAction: 'BOOK_NOW',
    ctaUrl: 'tel:+918518299881',
    targetCoordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    targetCity: 'Kurnool',
    selectedRadiusKm: 15, // STRICT <= 40 km
    budget: {
      total: 3500,
      spent: 1200,
      currency: 'INR',
      model: 'CPC',
      costPerUnit: 8
    },
    metrics: {
      impressions: 14200,
      eligibleViewersReached: 7100,
      clicks: 150,
      ctr: 1.05,
      conversions: 42,
      enquiries: 28
    },
    approvalStatus: 'approved',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-11-20T23:59:59Z',
    isActive: true,
    createdAt: '2026-10-31T08:00:00Z'
  },
  {
    id: 'ad_hyderabad_coworking_20km',
    businessId: 'biz_hyd_cowork',
    businessName: 'Nexus Hitec Hub Co-Working',
    businessCategory: 'Local Services',
    campaignName: 'Flex Desk Launch Offer in Madhapur',
    headline: 'High-Speed Fiber, Ergonomic Desks & 24/7 Access',
    bodyText: 'First 5 days free for indie developers, creators, and growing startup teams. Centrally situated near Durgam Cheruvu Metro.',
    creativeType: 'image',
    creativeGradient: 'from-violet-600 via-purple-700 to-slate-900',
    callToAction: 'BOOK_NOW',
    ctaUrl: 'https://nexushub.example.com',
    targetCoordinates: {
      latitude: 17.3850,
      longitude: 78.4867
    },
    targetCity: 'Hyderabad',
    selectedRadiusKm: 20, // STRICT <= 40 km
    budget: {
      total: 10000,
      spent: 4200,
      currency: 'INR',
      model: 'CPM',
      costPerUnit: 75
    },
    metrics: {
      impressions: 56000,
      eligibleViewersReached: 21500,
      clicks: 1420,
      ctr: 2.53,
      conversions: 94,
      enquiries: 52
    },
    approvalStatus: 'approved',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-11-30T23:59:59Z',
    isActive: true,
    createdAt: '2026-10-29T12:00:00Z'
  }
];

export const INITIAL_BUSINESSES: BusinessProfile[] = [
  {
    id: 'biz_kurnool_biryani',
    ownerId: 'owner_ramesh',
    name: 'Royal Rayalaseema Ruchulu',
    category: 'Restaurant & Dining',
    address: 'Near Old Bus Stand, Park Road',
    city: 'Kurnool',
    state: 'Andhra Pradesh',
    country: 'India',
    coordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    isVerified: true,
    phone: '+91 8518 244556',
    rating: 4.8,
    reviewCount: 342,
    coverGradient: 'from-amber-600 to-orange-900',
    tags: ['Biryani', 'Rayalaseema', 'Dine-in', 'Takeaway'],
    description: 'Heritage recipes passed down through three generations. Renowned for authentic pot biryani and country chicken curries.',
    openingHours: '11:30 AM - 11:00 PM Daily'
  },
  {
    id: 'biz_kurnool_handloom',
    ownerId: 'owner_kavitha',
    name: 'Rayalaseema Weavers Hub',
    category: 'Retail & Handicrafts',
    address: 'Gandhi Bazaar, Main Silk Street',
    city: 'Kurnool',
    state: 'Andhra Pradesh',
    country: 'India',
    coordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    isVerified: true,
    phone: '+91 8518 223344',
    rating: 4.9,
    reviewCount: 189,
    coverGradient: 'from-rose-600 to-purple-900',
    tags: ['Handloom', 'Silk Sarees', 'Cotton', 'Artisans'],
    description: 'Direct weaver cooperative showroom empowering 120+ rural artisan weaving families.',
    openingHours: '10:00 AM - 9:00 PM (Closed Tuesday)'
  },
  {
    id: 'biz_kurnool_health',
    ownerId: 'owner_dr_suresh',
    name: 'Kurnool Smile Care & Dental Hospital',
    category: 'Hospitals & Healthcare',
    address: 'Beside Bellary Chowrasta, Hospital Road',
    city: 'Kurnool',
    state: 'Andhra Pradesh',
    country: 'India',
    coordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    isVerified: true,
    phone: '+91 8518 299881',
    rating: 4.8,
    reviewCount: 96,
    coverGradient: 'from-cyan-600 to-blue-900',
    tags: ['Dental Care', 'Orthodontics', 'Implants'],
    description: 'State of the art dental surgical suite with digital scanning and painless laser dentistry.',
    openingHours: '9:00 AM - 8:30 PM (Sun: 10 AM - 2 PM)'
  },
  {
    id: 'biz_hyd_cowork',
    ownerId: 'owner_naveen',
    name: 'Nexus Hitec Hub Co-Working',
    category: 'Local Services',
    address: 'Plot 42, Hitec City Phase 2',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    coordinates: {
      latitude: 17.3850,
      longitude: 78.4867
    },
    isVerified: true,
    phone: '+91 40 45678901',
    rating: 4.7,
    reviewCount: 512,
    coverGradient: 'from-blue-600 to-indigo-900',
    tags: ['Workspace', 'High Speed WiFi', 'Meeting Rooms', 'Startup Hub'],
    description: 'Modern collaborative workspace for remote engineers, freelancers, and creative media teams.',
    openingHours: 'Open 24/7 for members'
  }
];

export const INITIAL_MARKETPLACE: MarketplaceListing[] = [
  {
    id: 'mkt_kurnool_saree_gadwal',
    businessId: 'biz_kurnool_handloom',
    sellerName: 'Rayalaseema Weavers Hub',
    sellerVerified: true,
    title: 'Authentic Handwoven Gadwal Zari Silk Saree',
    price: 4850,
    currency: 'INR',
    category: 'Handicrafts & Fashion',
    description: 'Handcrafted by master weavers with pure zari borders and temple pallu motifs. Local pickup or verified local courier within 40km.',
    coordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    cityName: 'Kurnool',
    maxDeliveryRadiusKm: 40,
    coverGradient: 'from-pink-700 via-rose-800 to-slate-900',
    condition: 'artisan',
    contactPhone: '+91 8518 223344',
    inStock: true,
    rating: 4.9
  },
  {
    id: 'mkt_kurnool_organic_spices',
    sellerName: 'Krishna Valley Organic Farms',
    sellerVerified: true,
    title: 'Farm-Fresh Stone Ground Turmeric & Guntur Spices (1kg)',
    price: 320,
    currency: 'INR',
    category: 'Food & Groceries',
    description: 'Cold-pressed and stone-ground locally without preservatives. Delivery available to all households within 25km of Kurnool.',
    coordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    cityName: 'Kurnool',
    maxDeliveryRadiusKm: 25,
    coverGradient: 'from-amber-600 via-yellow-700 to-stone-900',
    condition: 'new',
    contactPhone: '+91 9440 123456',
    inStock: true,
    rating: 4.8
  },
  {
    id: 'mkt_kurnool_clay_cookware',
    sellerName: 'Rayalaseema Clay Artisans Guild',
    sellerVerified: true,
    title: 'Natural Terracotta Clay Biryani Pot with Steam Lid (3L)',
    price: 650,
    currency: 'INR',
    category: 'Home & Kitchen',
    description: 'Traditional wood-fired clay cooking pot. Retains essential nutrients and authentic smoky flavor. Packed securely for local delivery.',
    coordinates: {
      latitude: 15.8281,
      longitude: 78.0373
    },
    cityName: 'Kurnool',
    maxDeliveryRadiusKm: 30,
    coverGradient: 'from-amber-800 to-stone-900',
    condition: 'artisan',
    contactPhone: '+91 8518 776655',
    inStock: true,
    rating: 4.7
  },
  {
    id: 'mkt_hyd_mechanical_keyboard',
    sellerName: 'Rohit Tech Gear',
    sellerVerified: false,
    title: 'Custom Gateron Brown Hot-Swap Mechanical Keyboard',
    price: 3500,
    currency: 'INR',
    category: 'Electronics',
    description: 'Lubed switches, RGB backlight, type-C detachable cable. Same-day hand-to-hand exchange in Hyderabad within 15km.',
    coordinates: {
      latitude: 17.3850,
      longitude: 78.4867
    },
    cityName: 'Hyderabad',
    maxDeliveryRadiusKm: 15,
    coverGradient: 'from-indigo-700 via-purple-800 to-slate-900',
    condition: 'used',
    contactPhone: '+91 9876 543210',
    inStock: true,
    rating: 4.6
  }
];

export const INITIAL_COMMUNITIES: CommunityGroup[] = [
  {
    id: 'comm_kurnool_city',
    name: 'Kurnool City Central Community',
    category: 'Neighborhood & City',
    description: 'The heartbeat of Kurnool! Civic discussions, road updates, local recommendations, and city life in our historic town.',
    city: 'Kurnool',
    isPrivate: false,
    membersCount: 4820,
    iconName: 'Building2',
    coverGradient: 'from-amber-600 to-orange-900',
    adminName: 'Suresh Varma',
    recentPostsCount: 42,
    tags: ['Kurnool', 'Civic', 'Community', 'News']
  },
  {
    id: 'comm_rayalaseema_farmers',
    name: 'Rayalaseema Farmers & Agri-Tech Forum',
    category: 'Agriculture',
    description: 'Direct agricultural market prices, drip irrigation techniques, drone spraying discussions, and seasonal crop advice for farmers.',
    city: 'Kurnool',
    isPrivate: false,
    membersCount: 2310,
    iconName: 'Sprout',
    coverGradient: 'from-emerald-700 to-teal-950',
    adminName: 'Ramanaiah Yadav',
    recentPostsCount: 68,
    tags: ['Agriculture', 'Farmers', 'Seeds', 'Irrigation']
  },
  {
    id: 'comm_kurnool_foodies',
    name: 'Kurnool Foodies & Chefs Circle',
    category: 'Food & Dining',
    description: 'Celebrating Rayalaseema cuisine! Discover best street food stalls, mutton curry secrets, uggani bajji spots, and new cafes.',
    city: 'Kurnool',
    isPrivate: false,
    membersCount: 3950,
    iconName: 'Utensils',
    coverGradient: 'from-rose-600 to-red-900',
    adminName: 'Sneha Reddy',
    recentPostsCount: 89,
    tags: ['Food', 'Biryani', 'Rayalaseema', 'Recipes']
  },
  {
    id: 'comm_kurnool_tech',
    name: 'Rayalaseema Tech & Developers Hub',
    category: 'Technology & Startups',
    description: 'Engineers, college graduates, and startup founders from Kurnool, Anantapur, and Kadapa connecting for tech jobs and hackathons.',
    city: 'Kurnool',
    isPrivate: false,
    membersCount: 1420,
    iconName: 'Code',
    coverGradient: 'from-indigo-600 to-blue-900',
    adminName: 'Vikram Joshi',
    recentPostsCount: 24,
    tags: ['Software', 'Developers', 'Jobs', 'Startups']
  }
];

export const INITIAL_JOBS: JobListing[] = [
  {
    id: 'job_kurnool_retail_manager',
    title: 'Store Operations & Customer Experience Manager',
    companyName: 'Royal Rayalaseema Ruchulu',
    city: 'Kurnool',
    category: 'Hospitality & Retail',
    jobType: 'Full-time',
    salaryRange: '₹28,000 - ₹35,000 / month',
    description: 'Oversee daily dine-in floor operations, team scheduling, inventory tracking, and guest satisfaction at our flagship Kurnool dining center.',
    requirements: ['2+ years hospitality experience', 'Telugu & English fluency', 'Basic POS billing systems'],
    contactPhone: '+91 8518 244556',
    postedDate: '2026-11-01',
    applicantsCount: 14
  },
  {
    id: 'job_kurnool_agri_advisor',
    title: 'Horticulture & Organic Farm Coordinator',
    companyName: 'Krishna Valley Organic Farms',
    city: 'Kurnool',
    category: 'Agriculture',
    jobType: 'Full-time',
    salaryRange: '₹22,000 - ₹30,000 / month',
    description: 'Field coordinator assisting 40+ contracted farmers with certified organic spice harvesting, packaging, and local cold storage dispatch.',
    requirements: ['B.Sc Agriculture or equivalent experience', 'Valid two-wheeler license', 'Local knowledge of Kurnool mandals'],
    contactPhone: '+91 9440 123456',
    postedDate: '2026-10-29',
    applicantsCount: 8
  },
  {
    id: 'job_kurnool_delivery_partner',
    title: 'Hyperlocal Delivery Associates (40km Radius)',
    companyName: 'LocalNet Express Logistics Hub',
    city: 'Kurnool',
    category: 'Logistics',
    jobType: 'Gig / Local',
    salaryRange: '₹18,000 - ₹25,000 / month + Incentives',
    description: 'Flexible daily shifts delivering fresh food, handlooms, and marketplace orders to homes within Kurnool city limits.',
    requirements: ['Smart phone with GPS', 'Motorcycle / Scooter with license', 'Friendly customer manners'],
    contactPhone: '+91 8518 001122',
    postedDate: '2026-11-02',
    applicantsCount: 31
  }
];

export const INITIAL_SERVICES: LocalServiceProvider[] = [
  {
    id: 'srv_kurnool_electricals',
    name: 'Sri Venkateswara Electricals & Inverter Works',
    serviceCategory: 'Electrician & Power',
    city: 'Kurnool',
    coordinates: { latitude: 15.8281, longitude: 78.0373 },
    serviceRadiusKm: 25, // STRICT <= 40 km
    rating: 4.9,
    reviewCount: 114,
    phone: '+91 9848 112233',
    experienceYears: 12,
    hourlyRate: '₹250 visiting fee',
    description: 'Complete home electrical wiring, UPS inverter installations, MCB trip diagnostics, and commercial lighting installations.',
    verified: true
  },
  {
    id: 'srv_kurnool_plumbing',
    name: 'Kurnool Rapid Plumbing & Tank Cleaning',
    serviceCategory: 'Plumbing & Water',
    city: 'Kurnool',
    coordinates: { latitude: 15.8281, longitude: 78.0373 },
    serviceRadiusKm: 30, // STRICT <= 40 km
    rating: 4.8,
    reviewCount: 89,
    phone: '+91 9441 556677',
    experienceYears: 9,
    hourlyRate: '₹200 inspection fee',
    description: 'Leak repair, motorized water pump repairs, PVC pipeline laying, and hygienic underground water tank cleaning.',
    verified: true
  },
  {
    id: 'srv_kurnool_tutor',
    name: 'Sravani Mathematics & Science Academy',
    serviceCategory: 'Education & Tutors',
    city: 'Kurnool',
    coordinates: { latitude: 15.8281, longitude: 78.0373 },
    serviceRadiusKm: 15, // STRICT <= 40 km
    rating: 5.0,
    reviewCount: 47,
    phone: '+91 8518 334455',
    experienceYears: 7,
    hourlyRate: '₹1,500 / month per student',
    description: 'Class 8 to 12 CBSE & AP State Board coaching. Small batches with personalized doubt clearance near Gayatri Estates.',
    verified: true
  }
];

export const INITIAL_EVENTS: LocalEvent[] = [
  {
    id: 'evt_kurnool_heritage_walk',
    title: 'Tungabhadra Heritage Walk & Riverfront Twilight Walk',
    organizer: 'Rayalaseema Heritage Trust',
    category: 'Culture & Heritage',
    date: 'Saturday, Nov 14, 2026',
    time: '5:00 PM - 7:30 PM',
    venue: 'Konda Reddy Buruju Fort Gateway to Riverbank',
    city: 'Kurnool',
    coordinates: { latitude: 15.8281, longitude: 78.0373 },
    description: 'Guided historical exploration walking through centuries of Vijayanagara architecture and medieval fortifications. Free entry for all families.',
    registeredCount: 184,
    isFree: true,
    coverGradient: 'from-amber-700 via-rose-800 to-slate-900'
  },
  {
    id: 'evt_kurnool_handloom_expo',
    title: 'Rayalaseema Handloom & Gadwal Silk Weavers Expo 2026',
    organizer: 'AP Weavers Cooperative Society',
    category: 'Exhibition & Shopping',
    date: 'Nov 18 - Nov 22, 2026',
    time: '10:00 AM - 9:00 PM Daily',
    venue: 'Zilla Parishad Convention Grounds, Kurnool',
    city: 'Kurnool',
    coordinates: { latitude: 15.8281, longitude: 78.0373 },
    description: 'Direct weaver-to-consumer exhibition showcasing Gadwal, Dharmavaram, and Pochampally weaves with live traditional spinning demonstrations.',
    registeredCount: 420,
    isFree: true,
    coverGradient: 'from-rose-700 via-purple-800 to-indigo-950'
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    type: 'geo_alert',
    title: 'Welcome to Kurnool Feed',
    message: 'Your device location is verified. Local commerce within 40 km and worldwide entertainment are active.',
    timestamp: '10 min ago',
    read: false,
    linkTab: 'home'
  },
  {
    id: 'notif_2',
    type: 'like',
    title: 'New Likes on Your Reel',
    message: 'Viewer from Hyderabad and 124 others liked "Kurnool Heritage Freestyle Dance".',
    timestamp: '1 hour ago',
    read: false,
    linkTab: 'reels'
  },
  {
    id: 'notif_3',
    type: 'campaign',
    title: 'Commercial Campaign Verified',
    message: 'Royal Rayalaseema Ruchulu ad campaign (25 km radius) is active and reaching local viewers.',
    timestamp: '3 hours ago',
    read: true,
    linkTab: 'local'
  }
];
