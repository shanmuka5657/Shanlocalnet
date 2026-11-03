import { IDatabaseClient } from '../postgresPool.ts';
import { UserProfile, UserRole, SupportedLanguage } from '../../types/index.ts';

function toDbRole(role: string): string {
  if (role === 'viewer') return 'user';
  if (role === 'merchant') return 'business_owner';
  if (role === 'admin') return 'platform_admin';
  return role;
}

function toAppRole(role: string): UserRole {
  if (role === 'user') return 'viewer';
  if (role === 'business_owner') return 'merchant';
  if (role === 'platform_admin') return 'community_admin';
  return role as UserRole;
}

export class UsersRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  public async getProfile(userId: string): Promise<UserProfile | null> {
    const res = await this.client.query(`
      SELECT
        u.id,
        u.active_role,
        u.email,
        u.phone,
        up.handle,
        up.display_name,
        up.avatar_url,
        up.bio,
        up.preferred_language,
        up.home_city,
        up.home_state,
        up.home_country,
        up.followers_count,
        up.following_count
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = $1 AND u.deleted_at IS NULL;
    `, [userId]);

    if (!res.rows || res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const rolesRes = await this.client.query(
      'SELECT role FROM user_roles WHERE user_id = $1;',
      [userId]
    );
    const roles = rolesRes.rows.map((r: any) => toAppRole(r.role));
    const activeAppRole = toAppRole(row.active_role);
    if (!roles.includes(activeAppRole)) {
      roles.push(activeAppRole);
    }

    return {
      id: row.id,
      name: row.display_name || 'Kurnool Local',
      handle: row.handle || `@${row.id}`,
      avatar: row.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      phone: row.phone || '+91 94401 23456',
      email: row.email || `${row.id}@localnet.in`,
      city: row.home_city || 'Kurnool',
      state: row.home_state || 'Andhra Pradesh',
      country: row.home_country || 'India',
      bio: row.bio || 'LocalNet user',
      roles,
      activeRole: activeAppRole,
      language: (row.preferred_language as SupportedLanguage) || 'en',
      verified: true,
      followersCount: Number(row.followers_count || 0),
      followingCount: Number(row.following_count || 0),
      savedPostIds: [],
      joinedCommunityIds: ['comm_kurnool_city']
    };
  }

  public async updateRole(userId: string, role?: string, language?: string): Promise<UserProfile | null> {
    if (role) {
      const dbRole = toDbRole(role);
      await this.client.query(`
        UPDATE users
        SET active_role = $1, updated_at = NOW()
        WHERE id = $2;
      `, [dbRole, userId]);

      await this.client.query(`
        INSERT INTO user_roles (user_id, role, status)
        VALUES ($1, $2, 'approved')
        ON CONFLICT (user_id, role) DO NOTHING;
      `, [userId, dbRole]);
    }

    if (language) {
      await this.client.query(`
        UPDATE user_profiles
        SET preferred_language = $1, updated_at = NOW()
        WHERE user_id = $2;
      `, [language, userId]);
    }

    return this.getProfile(userId);
  }

  public async ensureUser(user: Partial<UserProfile>): Promise<void> {
    const id = user.id || 'current_user_1';
    const activeDbRole = toDbRole(user.activeRole || 'creator');
    await this.client.query(`
      INSERT INTO users (id, email, phone, active_role, is_suspended)
      VALUES ($1, $2, $3, $4, FALSE)
      ON CONFLICT (id) DO UPDATE
      SET active_role = EXCLUDED.active_role, email = EXCLUDED.email;
    `, [id, user.email || `${id}@localnet.in`, user.phone || null, activeDbRole]);

    await this.client.query(`
      INSERT INTO user_profiles (
        user_id, handle, display_name, avatar_url, bio, preferred_language,
        home_city, home_state, home_country, home_country_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'IN')
      ON CONFLICT (user_id) DO NOTHING;
    `, [
      id,
      user.handle || `@${id}`,
      user.name || 'Local User',
      user.avatar || '',
      user.bio || '',
      user.language || 'en',
      user.city || 'Kurnool',
      user.state || 'Andhra Pradesh',
      user.country || 'India'
    ]);

    if (user.roles) {
      for (const r of user.roles) {
        const dbRole = toDbRole(r);
        await this.client.query(`
          INSERT INTO user_roles (user_id, role, status)
          VALUES ($1, $2, 'approved')
          ON CONFLICT (user_id, role) DO NOTHING;
        `, [id, dbRole]);
      }
    }
  }
}
