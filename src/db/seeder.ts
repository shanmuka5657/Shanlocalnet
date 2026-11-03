import { IDatabaseClient } from './postgresPool.ts';
import {
  CURRENT_USER,
  INITIAL_POSTS,
  INITIAL_BUSINESSES,
  INITIAL_AD_CAMPAIGNS,
  INITIAL_MARKETPLACE,
  INITIAL_COMMUNITIES,
  INITIAL_JOBS,
  INITIAL_SERVICES,
  INITIAL_EVENTS,
  INITIAL_NOTIFICATIONS
} from '../lib/mockData.ts';
import { UsersRepository } from './repositories/usersRepository.ts';
import { PostsRepository } from './repositories/postsRepository.ts';
import { BusinessesRepository } from './repositories/businessesRepository.ts';
import { CampaignsRepository } from './repositories/campaignsRepository.ts';

export async function seedDatabase(client: IDatabaseClient): Promise<void> {
  const usersRepo = new UsersRepository(client);
  const postsRepo = new PostsRepository(client);
  const bizRepo = new BusinessesRepository(client);
  const campRepo = new CampaignsRepository(client);

  // 1. Seed Current User
  await usersRepo.ensureUser(CURRENT_USER);

  // Also ensure platform admin user for tests
  await usersRepo.ensureUser({
    id: 'user_admin_platform',
    name: 'Platform Administrator',
    email: 'admin@localnet.in',
    activeRole: 'platform_admin' as any,
    roles: ['platform_admin' as any]
  });

  // 2. Seed Businesses
  const bizCheck = await client.query('SELECT COUNT(*) AS count FROM businesses;');
  if (Number(bizCheck.rows[0]?.count || 0) === 0) {
    for (const b of INITIAL_BUSINESSES) {
      await bizRepo.createBusiness(b);
      // Mark initial businesses verified
      await bizRepo.verifyBusiness(b.id, 'user_admin_platform');
    }
    console.log(`[LocalNet Seeder] Seeded ${INITIAL_BUSINESSES.length} initial businesses.`);
  }

  // 3. Seed Posts
  const postCheck = await client.query('SELECT COUNT(*) AS count FROM posts;');
  if (Number(postCheck.rows[0]?.count || 0) === 0) {
    for (const p of INITIAL_POSTS) {
      await postsRepo.createPost(p);
    }
    console.log(`[LocalNet Seeder] Seeded ${INITIAL_POSTS.length} initial posts.`);
  }

  // 4. Seed Campaigns
  const campCheck = await client.query('SELECT COUNT(*) AS count FROM campaigns;');
  if (Number(campCheck.rows[0]?.count || 0) === 0) {
    for (const c of INITIAL_AD_CAMPAIGNS) {
      try {
        await campRepo.createCampaign(c);
      } catch (err: any) {
        console.warn(`[LocalNet Seeder] Campaign ${c.id} skipped:`, err?.message);
      }
    }
    console.log(`[LocalNet Seeder] Seeded initial campaigns.`);
  }

  // 5. Seed Marketplace
  const mktCheck = await client.query('SELECT COUNT(*) AS count FROM marketplace_listings;');
  if (Number(mktCheck.rows[0]?.count || 0) === 0) {
    for (const m of INITIAL_MARKETPLACE) {
      await client.query(`
        INSERT INTO marketplace_listings (
          id, seller_user_id, seller_name, seller_verified,
          title, description, category, price_paise, currency,
          origin_point, city_name, max_delivery_radius_km,
          cover_gradient, condition, contact_phone, is_active
        )
        VALUES (
          $1, 'current_user_1', $2, TRUE,
          $3, $4, $5, $6, 'INR',
          ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10,
          $11, 'new', '+91 94401 23456', TRUE
        )
        ON CONFLICT (id) DO NOTHING;
      `, [
        m.id, m.sellerName, m.title, m.description, m.category,
        Math.round(m.price * 100),
        m.coordinates.longitude, m.coordinates.latitude,
        m.cityName, m.maxDeliveryRadiusKm,
        m.coverGradient
      ]);

      await client.query(`
        INSERT INTO inventory (listing_id, available_qty, reserved_qty)
        VALUES ($1, 20, 0)
        ON CONFLICT (listing_id) DO NOTHING;
      `, [m.id]);
    }
    console.log(`[LocalNet Seeder] Seeded ${INITIAL_MARKETPLACE.length} marketplace listings.`);
  }

  // 6. Seed Communities
  const commCheck = await client.query('SELECT COUNT(*) AS count FROM communities;');
  if (Number(commCheck.rows[0]?.count || 0) === 0) {
    for (const c of INITIAL_COMMUNITIES) {
      await client.query(`
        INSERT INTO communities (
          id, name, category, description, city, origin_point,
          radius_km, is_private, members_count, icon_name, cover_gradient,
          admin_user_id, admin_name, recent_posts_count, tags
        )
        VALUES (
          $1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint(78.0373, 15.8281), 4326)::geography,
          40.00, $6, $7, $8, $9,
          'current_user_1', $10, $11, $12
        )
        ON CONFLICT (id) DO NOTHING;
      `, [
        c.id, c.name, c.category, c.description, c.city,
        c.isPrivate, c.membersCount, c.iconName, c.coverGradient,
        c.adminName, c.recentPostsCount, JSON.stringify(c.tags)
      ]);
    }
    console.log(`[LocalNet Seeder] Seeded ${INITIAL_COMMUNITIES.length} communities.`);
  }

  // 7. Seed Jobs
  const jobCheck = await client.query('SELECT COUNT(*) AS count FROM jobs;');
  if (Number(jobCheck.rows[0]?.count || 0) === 0) {
    for (const j of INITIAL_JOBS) {
      await client.query(`
        INSERT INTO jobs (
          id, business_id, title, company_name, city, origin_point,
          category, job_type, salary_range, description, requirements,
          contact_phone, posted_date, applicants_count
        )
        VALUES (
          $1, 'biz_kurnool_biryani', $2, $3, $4,
          ST_SetSRID(ST_MakePoint(78.0373, 15.8281), 4326)::geography,
          $5, $6, $7, $8, $9,
          $10, $11, $12
        )
        ON CONFLICT (id) DO NOTHING;
      `, [
        j.id, j.title, j.companyName, j.city,
        j.category, j.jobType, j.salaryRange, j.description, JSON.stringify(j.requirements),
        j.contactPhone, j.postedDate, j.applicantsCount
      ]);
    }
    console.log(`[LocalNet Seeder] Seeded ${INITIAL_JOBS.length} jobs.`);
  }

  // 8. Seed Services
  const srvCheck = await client.query('SELECT COUNT(*) AS count FROM service_providers;');
  if (Number(srvCheck.rows[0]?.count || 0) === 0) {
    for (const s of INITIAL_SERVICES) {
      const providerUserId = `user_${s.id}`;
      await usersRepo.ensureUser({
        id: providerUserId,
        name: s.name,
        phone: s.phone,
        activeRole: 'service_provider' as any
      });

      await client.query(`
        INSERT INTO service_providers (
          id, user_id, name, service_category, city, origin_point,
          service_radius_km, rating, review_count, phone, experience_years,
          hourly_rate, description, verified
        )
        VALUES (
          $1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
          $8, $9, $10, $11, $12,
          $13, $14, $15
        )
        ON CONFLICT (id) DO NOTHING;
      `, [
        s.id, providerUserId, s.name, s.serviceCategory, s.city,
        s.coordinates.longitude, s.coordinates.latitude,
        s.serviceRadiusKm, s.rating, s.reviewCount, s.phone, s.experienceYears,
        s.hourlyRate || '₹250 visiting fee', s.description, s.verified
      ]);
    }
    console.log(`[LocalNet Seeder] Seeded ${INITIAL_SERVICES.length} service providers.`);
  }

  // 9. Seed Events
  const evtCheck = await client.query('SELECT COUNT(*) AS count FROM events;');
  if (Number(evtCheck.rows[0]?.count || 0) === 0) {
    for (const e of INITIAL_EVENTS) {
      await client.query(`
        INSERT INTO events (
          id, title, organizer, category, event_date, event_time,
          venue, city, origin_point, description, registered_count,
          is_free, price_inr, cover_gradient
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
          $11, $12, $13, $14, $15
        )
        ON CONFLICT (id) DO NOTHING;
      `, [
        e.id, e.title, e.organizer, e.category, e.date, e.time,
        e.venue, e.city, e.coordinates.longitude, e.coordinates.latitude,
        e.description, e.registeredCount, e.isFree, e.price || 0, e.coverGradient
      ]);
    }
    console.log(`[LocalNet Seeder] Seeded ${INITIAL_EVENTS.length} events.`);
  }

  // 10. Seed Notifications
  const notifCheck = await client.query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1;', [CURRENT_USER.id]);
  if (Number(notifCheck.rows[0]?.count || 0) === 0) {
    for (const n of INITIAL_NOTIFICATIONS) {
      await client.query(`
        INSERT INTO notifications (id, user_id, type, title, message, timestamp_label, link_tab, is_read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING;
      `, [n.id, CURRENT_USER.id, n.type, n.title, n.message, n.timestamp || 'Just now', n.linkTab, n.read]);
    }
  }
}
