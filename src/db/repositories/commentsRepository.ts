import { IDatabaseClient } from '../postgresPool.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  body: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddCommentInput {
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  body: string;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class CommentsRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  /**
   * Fetch all non-deleted comments for a post, newest first.
   * Returns up to 100 comments per request (cursor pagination can be added later).
   */
  public async getCommentsForPost(postId: string, limit = 100): Promise<Comment[]> {
    const result = await this.client.query<Comment>(
      `SELECT
         id,
         post_id       AS "postId",
         user_id       AS "userId",
         user_name     AS "userName",
         user_avatar   AS "userAvatar",
         body,
         is_deleted    AS "isDeleted",
         created_at    AS "createdAt",
         updated_at    AS "updatedAt"
       FROM post_comments
       WHERE post_id = $1 AND is_deleted = FALSE
       ORDER BY created_at DESC
       LIMIT $2;`,
      [postId, limit]
    );
    return result.rows;
  }

  /**
   * Add a new comment and increment the post's comment_count atomically.
   */
  public async addComment(input: AddCommentInput): Promise<Comment> {
    const id = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { postId, userId, userName, userAvatar, body } = input;

    // Insert comment + update counter in a single transaction
    await this.client.query('BEGIN;');
    try {
      const insertResult = await this.client.query<Comment>(
        `INSERT INTO post_comments (id, post_id, user_id, user_name, user_avatar, body)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
           id,
           post_id     AS "postId",
           user_id     AS "userId",
           user_name   AS "userName",
           user_avatar AS "userAvatar",
           body,
           is_deleted  AS "isDeleted",
           created_at  AS "createdAt",
           updated_at  AS "updatedAt";`,
        [id, postId, userId, userName, userAvatar ?? null, body.trim()]
      );

      // Increment denormalised counter
      await this.client.query(
        `UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1;`,
        [postId]
      );

      await this.client.query('COMMIT;');
      return insertResult.rows[0];
    } catch (err) {
      await this.client.query('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Soft-delete a comment (only the author or an admin should call this).
   * Decrements the post's comment_count.
   */
  public async deleteComment(commentId: string, requestingUserId: string): Promise<boolean> {
    // Verify ownership first
    const check = await this.client.query(
      `SELECT user_id, post_id FROM post_comments WHERE id = $1 AND is_deleted = FALSE;`,
      [commentId]
    );
    if (check.rows.length === 0) return false;

    const { user_id: ownerId, post_id: postId } = check.rows[0] as any;
    if (ownerId !== requestingUserId) {
      throw new Error('Forbidden: you can only delete your own comments');
    }

    await this.client.query('BEGIN;');
    try {
      await this.client.query(
        `UPDATE post_comments SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1;`,
        [commentId]
      );
      await this.client.query(
        `UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1;`,
        [postId]
      );
      await this.client.query('COMMIT;');
      return true;
    } catch (err) {
      await this.client.query('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Get the total comment count for a post (from the denormalised column).
   */
  public async getCommentCount(postId: string): Promise<number> {
    const result = await this.client.query(
      `SELECT comment_count FROM posts WHERE id = $1;`,
      [postId]
    );
    return result.rows[0]?.comment_count ?? 0;
  }
}

