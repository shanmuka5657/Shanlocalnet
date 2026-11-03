# LocalNet — Global Entertainment. Local Commerce.

LocalNet is a hyper-local social entertainment and neighborhood commerce platform architected for **AWS Mumbai (`ap-south-1`)** and **PostgreSQL 16 + PostGIS 3.4**.

---

## Core Product Invariant: Dual Distribution Engines

LocalNet enforces two strictly separated distribution engines at both the **application layer** and the **PostgreSQL/PostGIS database layer**:

1. **Engine A — Organic Entertainment Distribution (`posts`)**
   - Supports flexible creator reach scopes: `5km`, `10km`, `25km`, `40km`, `city`, `state`, `country` (India), and `global` (Worldwide).
   - Enforced via database constraint `chk_posts_organic_radius_coupling` and spatial index `idx_posts_origin_geog_gist`.
   - Zero commercial budget or ad-radius restrictions apply to organic entertainment.

2. **Engine B — Commercial & Hyper-Local Distribution (`ad_campaigns`, `marketplace_listings`)**
   - **Hard 40 km Ceiling**: Every commercial campaign and marketplace listing is strictly bounded to `radius_km <= 40` (`40,000 meters`).
   - Enforced via database constraints `chk_ad_campaigns_40km_ceiling`, `chk_ad_campaigns_scope_type`, and `chk_marketplace_40km_ceiling`, plus spherical `ST_DWithin(origin_geog, viewer_geog, radius_km * 1000.0, true)` predicates.
   - **Immutable Origin Coordinates**: Triggers `trg_posts_origin_immutable`, `trg_ad_campaigns_origin_immutable`, `trg_business_origin_immutable`, and `trg_marketplace_origin_immutable` reject any `UPDATE` to `origin_lat`, `origin_lng`, or `origin_geog` unless explicitly authorized within a transaction via `SET LOCAL localnet.allow_origin_correction = 'on'` with a mandatory audit record in `moderation_audit_logs`.

---

## Repository Structure

```text
├── .env.example                                     # Safe environment template (no secrets)
├── Dockerfile                                       # Production multi-stage container build
├── docker-compose.yml                               # Local PostgreSQL 16 + PostGIS 3.4 stack
├── server.ts                                        # Express + Vite full-stack server & API routes
├── package.json                                     # Dependencies and scripts
├── public/
│   └── videos/                                      # Local vertical MP4 assets for Reels
└── src/
    ├── App.tsx                                      # Root application shell & navigation
    ├── components/
    │   ├── AuthModal.tsx                            # Authentication & session switcher
    │   ├── BottomNavBar.tsx                         # Mobile-first 5-tab navigation bar
    │   ├── BusinessAdHub.tsx                        # Engine B Ad Campaign Manager (40 km ceiling)
    │   ├── CreateModal.tsx                          # Post, Reel, Product & Campaign composer
    │   ├── DistributionEngineLab.tsx                # 7 Geographic Proofs + 12 Stage B.1 Tests Lab
    │   ├── EligibilityExplainerModal.tsx            # Spatial & policy explainability inspector
    │   ├── ExploreView.tsx                          # Global & regional entertainment discovery
    │   ├── HomeFeed.tsx                             # Feed / Reels / Following unified view
    │   ├── LocalHubView.tsx                         # Neighborhood communities, events & services
    │   ├── LocationModal.tsx                        # GPS & Indian city coordinate selector
    │   ├── MarketplaceView.tsx                      # Hyper-local <=40 km commerce marketplace
    │   ├── NotificationsModal.tsx                   # Activity & campaign notifications
    │   ├── ProfileView.tsx                          # Creator & verified business profile view
    │   ├── ReelsView.tsx                            # Full-screen vertical 9:16 Reels player
    │   └── TopNavigation.tsx                        # Responsive top bar with Verification Lab trigger
    ├── context/
    │   └── LocationContext.tsx                      # Active viewer coordinates & Haversine context
    ├── db/
    │   ├── migrations/
    │   │   ├── 0001_roles_and_extensions.sql        # UP: Least-privilege DB roles & PostGIS extensions
    │   │   ├── 0001_roles_and_extensions.down.sql   # DOWN: Clean rollback of roles & extensions
    │   │   ├── 0002_corrected_postgis_schema.sql    # UP: All 35 tables, triggers, GiST & outbox
    │   │   └── 0002_corrected_postgis_schema.down.sql # DOWN: Deterministic reverse-dependency drop
    │   ├── schema/                                  # Modular Drizzle / TypeScript schema definitions
    │   │   ├── identity.ts
    │   │   ├── geo.ts
    │   │   ├── social.ts
    │   │   ├── business.ts
    │   │   ├── ads.ts
    │   │   ├── marketplace.ts
    │   │   └── community.ts
    │   ├── postgresPool.ts                          # Dual-pool pg connector (runtime vs migrator)
    │   ├── stageB1Engine.ts                         # Stage B.1 transactional enforcement engine
    │   └── stage_b1_verification.ts                 # 12 automated Stage B.1 architectural tests
    ├── lib/
    │   ├── geo.ts                                   # Haversine & dual-engine eligibility evaluators
    │   ├── i18n.ts                                  # Multilingual support (EN, HI, TE, TA, KN)
    │   └── mockData.ts                              # Initial seed dataset for local development
    └── types/
        └── index.ts                                 # Shared TypeScript domain interfaces
```

---

## Database Architecture (Stage B.1 — 35 Tables)

### Least-Privilege PostgreSQL Roles (`0001_roles_and_extensions.sql`)
- `localnet_migrator`: Owns schema objects, tables, indexes, and triggers; runs DDL migrations.
- `localnet_app`: Runtime application role (`NOBYPASSRLS`, `NOSUPERUSER`, `NOCREATEDB`). Cannot `DROP`, `ALTER`, or `TRUNCATE` tables, and cannot `UPDATE` or `DELETE` rows in `moderation_audit_logs`.
- `localnet_readonly`: Read-only diagnostics and analytics role.

### Complete 35-Table Schema (`0002_corrected_postgis_schema.sql`)
1. Identity & Access: `users`, `user_profiles`, `creator_profiles`, `user_sessions`, `user_settings`, `user_Verification_requests`, `user_blocks`
2. Geographic Reference: `geo_countries`, `geo_states`, `geo_cities`, `geo_localities`, `user_saved_locations`
3. Social & Organic Engine A: `posts`, `post_media`, `post_hashtags`, `post_likes`, `post_saves`, `post_comments`, `post_shares`, `user_follows`
4. Business & Commercial Engine B: `business_profiles`, `business_verification_docs`, `ad_campaigns`, `ad_creatives`, `ad_impressions`, `ad_clicks`
5. Hyper-Local Marketplace: `marketplace_categories`, `marketplace_listings`, `marketplace_inquiries`, `marketplace_saved_items`
6. Communities, Events & Governance: `local_communities`, `community_members`, `local_events`, `notifications`, `moderation_audit_logs`
7. Transactional Reliability: `transactional_outbox` (exponential backoff, worker locking, dead-letter transition)

---

## Local Development & Verification

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start the full-stack server (port 3000):**
   ```bash
   npm run dev
   ```

4. **Run the 12 Stage B.1 Automated Verification Tests:**
   ```bash
   npx tsx -e "import { runStageB1VerificationSuite } from './src/db/stage_b1_verification'; const r = runStageB1VerificationSuite(); console.log(r.passed + '/' + r.totalTests + ' passed'); if (!r.allPassed) process.exit(1);"
   ```
