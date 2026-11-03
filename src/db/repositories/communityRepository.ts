import { IDatabaseClient } from '../postgresPool.ts';
import {
  CommunityGroup,
  JobListing,
  LocalServiceProvider,
  LocalEvent,
  NotificationItem
} from '../../types/index.ts';
import { MAXIMUM_COMMERCIAL_RADIUS_KM } from '../../lib/geo.ts';

export class CommunityRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  // COMMUNITIES
  public async listCommunities(): Promise<CommunityGroup[]> {
    const res = await this.client.query(`
      SELECT
        c.*,
        ST_X(c.origin_point::geometry) AS lon,
        ST_Y(c.origin_point::geometry) AS lat
      FROM communities c
      ORDER BY c.members_count DESC;
    `);

    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      city: r.city,
      membersCount: Number(r.members_count || 1),
      isPrivate: Boolean(r.is_private),
      iconName: r.icon_name || 'Users',
      coverGradient: r.cover_gradient || 'from-blue-600 via-indigo-700 to-slate-900',
      adminName: r.admin_name || 'Community Admin',
      recentPostsCount: Number(r.recent_posts_count || 5),
      tags: Array.isArray(r.tags) ? r.tags : typeof r.tags === 'string' ? JSON.parse(r.tags) : ['Kurnool', r.category]
    }));
  }

  public async joinCommunity(communityId: string, userId = 'current_user_1'): Promise<void> {
    await this.client.transaction(async (tx) => {
      await tx.query(`
        INSERT INTO community_members (community_id, user_id, role, joined_at)
        VALUES ($1, $2, 'member', NOW())
        ON CONFLICT (community_id, user_id) DO NOTHING;
      `, [communityId, userId]);

      await tx.query(`
        UPDATE communities
        SET members_count = members_count + 1
        WHERE id = $1;
      `, [communityId]);
    });
  }

  // JOBS
  public async listJobs(): Promise<JobListing[]> {
    const res = await this.client.query(`
      SELECT *
      FROM jobs
      ORDER BY created_at DESC;
    `);

    return res.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      companyName: r.company_name || 'Local Business',
      city: r.city || 'Kurnool',
      category: r.category || 'General',
      jobType: (r.job_type === 'Full-time' || r.job_type === 'Part-time' || r.job_type === 'Gig / Local') ? r.job_type : 'Full-time',
      salaryRange: r.salary_range || '₹15,000 - ₹25,000/mo',
      description: r.description || '',
      requirements: Array.isArray(r.requirements) ? r.requirements : typeof r.requirements === 'string' ? JSON.parse(r.requirements) : [],
      contactPhone: r.contact_phone || '+91 8518 000000',
      postedDate: r.posted_date || (r.created_at || new Date()).toString(),
      applicantsCount: Number(r.applicants_count || 0)
    }));
  }

  public async applyJob(jobId: string, userId = 'current_user_1'): Promise<void> {
    await this.client.transaction(async (tx) => {
      await tx.query(`
        INSERT INTO job_applications (job_id, applicant_user_id, status, applied_at)
        VALUES ($1, $2, 'submitted', NOW())
        ON CONFLICT DO NOTHING;
      `, [jobId, userId]);

      await tx.query(`
        UPDATE jobs
        SET applicants_count = applicants_count + 1
        WHERE id = $1;
      `, [jobId]);
    });
  }

  // SERVICES
  public async listServices(): Promise<LocalServiceProvider[]> {
    const res = await this.client.query(`
      SELECT
        s.*,
        ST_X(s.origin_point::geometry) AS lon,
        ST_Y(s.origin_point::geometry) AS lat
      FROM service_providers s;
    `);

    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name || 'Local Professional',
      serviceCategory: r.service_category || 'Local Service',
      city: r.city || 'Kurnool',
      coordinates: {
        latitude: Number(r.lat || 15.8281),
        longitude: Number(r.lon || 78.0373)
      },
      serviceRadiusKm: Math.min(Number(r.service_radius_km || 25), MAXIMUM_COMMERCIAL_RADIUS_KM),
      rating: Number(r.rating || 5.0),
      reviewCount: Number(r.review_count || 1),
      phone: r.phone || '+91 94401 23456',
      experienceYears: Number(r.experience_years || 5),
      hourlyRate: r.hourly_rate || '₹250 visiting fee',
      description: r.description || 'Verified local service provider in Kurnool.',
      verified: Boolean(r.verified)
    }));
  }

  // EVENTS
  public async listEvents(): Promise<LocalEvent[]> {
    const res = await this.client.query(`
      SELECT
        e.*,
        ST_X(e.origin_point::geometry) AS lon,
        ST_Y(e.origin_point::geometry) AS lat
      FROM events e
      ORDER BY e.created_at DESC;
    `);

    return res.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      organizer: r.organizer || 'Kurnool Cultural Society',
      category: r.category || 'Festival',
      date: r.event_date || new Date().toISOString(),
      time: r.event_time || '6:00 PM',
      venue: r.venue || 'Kurnool Town Hall',
      city: r.city || 'Kurnool',
      coordinates: {
        latitude: Number(r.lat || 15.8281),
        longitude: Number(r.lon || 78.0373)
      },
      coverGradient: r.cover_gradient || 'from-rose-600 via-pink-600 to-indigo-900',
      description: r.description || 'Community gathering in Kurnool.',
      isFree: Boolean(r.is_free),
      price: Number(r.price_inr || 0),
      registeredCount: Number(r.registered_count || 0)
    }));
  }

  public async registerEvent(eventId: string, userId = 'current_user_1'): Promise<void> {
    await this.client.transaction(async (tx) => {
      await tx.query(`
        INSERT INTO event_registrations (event_id, user_id, registered_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING;
      `, [eventId, userId]);

      await tx.query(`
        UPDATE events
        SET registered_count = registered_count + 1
        WHERE id = $1;
      `, [eventId]);
    });
  }

  // NOTIFICATIONS
  public async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    linkTab: string,
    timestampLabel = 'Just now'
  ): Promise<NotificationItem> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await this.client.query(`
      INSERT INTO notifications (id, user_id, type, title, message, timestamp_label, link_tab, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW());
    `, [id, userId, type, title, message, timestampLabel, linkTab]);

    return {
      id,
      type: type as any,
      title,
      message,
      timestamp: timestampLabel,
      read: false,
      linkTab: linkTab as any
    };
  }

  public async listNotifications(userId = 'current_user_1'): Promise<NotificationItem[]> {
    const res = await this.client.query(`
      SELECT *
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50;
    `, [userId]);

    return res.rows.map((r: any) => ({
      id: r.id.toString(),
      type: r.type,
      title: r.title,
      message: r.message,
      timestamp: r.timestamp_label || 'Recently',
      read: Boolean(r.is_read),
      linkTab: r.link_tab || 'home'
    }));
  }
}
