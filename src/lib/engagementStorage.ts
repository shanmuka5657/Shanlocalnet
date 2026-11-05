import { Post } from '../types/index.ts';

export interface FeedComment {
  id: string;
  author: string;
  authorAvatar: string;
  text: string;
  likes: number;
  hasLiked?: boolean;
  time: string;
  replyTo?: string;
  createdAt?: string;
}

const LIKES_KEY = 'localnet_likes_v2';
const COMMENTS_KEY = 'localnet_comments_v2';
const VIEWS_KEY = 'localnet_views_v2';
const AD_VIEWS_KEY = 'localnet_ad_views_v2';
const USER_POSTS_KEY = 'localnet_user_posts_v2';

export const INITIAL_DEMO_COMMENTS: Record<string, FeedComment[]> = {
  post_kurnool_dance_worldwide: [
    {
      id: 'c1',
      author: 'Suresh Kumar',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
      text: 'Proud of Kurnool! Amazing moves at the fort 🔥',
      likes: 14,
      time: '2h ago'
    },
    {
      id: 'c2',
      author: 'Charlotte H.',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
      text: 'Watching this all the way from London! Love the beats.',
      likes: 8,
      time: '1h ago'
    }
  ],
  post_hyderabad_tech_comedy_worldwide: [
    {
      id: 'c3',
      author: 'Vikram J.',
      authorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80',
      text: 'Literally had this happen in today sprint demo 😂',
      likes: 21,
      time: '3h ago'
    },
    {
      id: 'c4',
      author: 'Anita Rao',
      authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80',
      text: 'Relatable for every engineer in Hitec City and beyond!',
      likes: 12,
      time: '45m ago'
    }
  ]
};

// ---------------------------------------------------------------------------
// 1. LIKES PERSISTENCE
// ---------------------------------------------------------------------------

export function getStoredLikes(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setStoredLike(postId: string, liked: boolean): void {
  try {
    const likes = getStoredLikes();
    if (liked) {
      likes[postId] = true;
    } else {
      delete likes[postId];
    }
    localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
  } catch {}
}

// ---------------------------------------------------------------------------
// 2. COMMENTS PERSISTENCE
// ---------------------------------------------------------------------------

export function getAllStoredComments(): Record<string, FeedComment[]> {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...INITIAL_DEMO_COMMENTS, ...parsed };
  } catch {
    return { ...INITIAL_DEMO_COMMENTS };
  }
}

export function getStoredComments(postId: string): FeedComment[] {
  const all = getAllStoredComments();
  return all[postId] || [];
}

export function addStoredComment(postId: string, comment: FeedComment): FeedComment[] {
  try {
    const all = getAllStoredComments();
    const updated = [...(all[postId] || []), comment];
    all[postId] = updated;
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    return updated;
  } catch {
    return [comment];
  }
}

export function toggleStoredCommentLike(postId: string, commentId: string): FeedComment[] {
  try {
    const all = getAllStoredComments();
    const list = (all[postId] || []).map(c => {
      if (c.id === commentId) {
        const hasLiked = !c.hasLiked;
        return {
          ...c,
          hasLiked,
          likes: c.likes + (hasLiked ? 1 : -1)
        };
      }
      return c;
    });
    all[postId] = list;
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    return list;
  } catch {
    return [];
  }
}

export function mergePostComments(currentList: FeedComment[], serverComments: FeedComment[]): FeedComment[] {
  const current = currentList || [];
  const incoming = serverComments || [];
  const seenIds = new Set(current.map(c => c.id));
  const seenTexts = new Set(current.map(c => `${c.author}:${c.text.trim()}`));

  const toAdd: FeedComment[] = [];
  for (const sc of incoming) {
    const textKey = `${sc.author}:${sc.text.trim()}`;
    if (!seenIds.has(sc.id) && !seenTexts.has(textKey)) {
      toAdd.push(sc);
      seenIds.add(sc.id);
      seenTexts.add(textKey);
    }
  }
  return [...current, ...toAdd];
}

export function mergeServerComments(serverMap: Record<string, FeedComment[]>): Record<string, FeedComment[]> {
  try {
    const all = getAllStoredComments();
    for (const [postId, serverComments] of Object.entries(serverMap || {})) {
      if (!serverComments || !Array.isArray(serverComments)) continue;
      all[postId] = mergePostComments(all[postId] || [], serverComments);
    }
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    return all;
  } catch {
    return serverMap || {};
  }
}

// ---------------------------------------------------------------------------
// 3. VIDEO & REEL VIEWS PERSISTENCE
// ---------------------------------------------------------------------------

export function getStoredViews(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getPostViewCount(postId: string, baseCount = 0): number {
  const views = getStoredViews();
  const delta = views[postId] || 0;
  return baseCount + delta;
}

export function incrementStoredView(postId: string): number {
  try {
    const views = getStoredViews();
    views[postId] = (views[postId] || 0) + 1;
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
    return views[postId];
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// 4. COMMERCIAL AD IMPRESSIONS / VIEWS PERSISTENCE
// ---------------------------------------------------------------------------

export function getStoredAdViews(): Record<string, number> {
  try {
    const raw = localStorage.getItem(AD_VIEWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getAdViewCount(adId: string, baseCount = 0): number {
  const adViews = getStoredAdViews();
  const delta = adViews[adId] || 0;
  return baseCount + delta;
}

export function incrementStoredAdView(adId: string): number {
  try {
    const adViews = getStoredAdViews();
    adViews[adId] = (adViews[adId] || 0) + 1;
    localStorage.setItem(AD_VIEWS_KEY, JSON.stringify(adViews));
    return adViews[adId];
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// 5. USER-CREATED POSTS PERSISTENCE (Survives Refresh & Serverless Cold Starts)
// ---------------------------------------------------------------------------

export function getStoredUserPosts(): Post[] {
  try {
    const raw = localStorage.getItem(USER_POSTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Filter out posts that stored temporary in-memory blob URLs which expire across sessions
    const sanitizedList = list.filter((p: any) => {
      if (p?.mediaUrl && typeof p.mediaUrl === 'string' && p.mediaUrl.startsWith('blob:')) {
        return false;
      }
      return true;
    });
    return sanitizedList.map((p: any) => {
      const author = p.author || {};
      const creatorName = p.creatorName || author.name || 'Local Creator';
      const creatorHandle = p.creatorHandle || author.handle || '@creator';
      const creatorAvatar = p.creatorAvatar || author.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80';
      const creatorVerified = p.creatorVerified !== undefined ? p.creatorVerified : (author.verified ?? true);
      const contentType = p.contentType || p.type || 'reel';
      const title = p.title || p.caption || 'Local Short';
      const description = p.description || p.caption || '';
      const mediaThumbnail = p.mediaThumbnail || p.thumbnailUrl || undefined;

      return {
        ...p,
        creatorId: p.creatorId || p.userId || author.id || 'usr_local_creator',
        creatorName,
        creatorHandle,
        creatorAvatar,
        creatorVerified,
        contentType,
        type: contentType,
        classification: p.classification || 'organic',
        title,
        description,
        mediaThumbnail,
        thumbnailUrl: mediaThumbnail,
        stats: p.stats || {
          likes: p.likesCount || 1,
          comments: p.commentsCount || 0,
          shares: p.sharesCount || 0,
          saves: p.savesCount || 0,
          views: 1
        },
        moderation: p.moderation || { status: 'approved' }
      } as Post;
    });
  } catch {
    return [];
  }
}

export function saveStoredUserPost(newPost: Post): void {
  try {
    const current = getStoredUserPosts();
    // Prepend and filter duplicates
    const updated = [newPost, ...current.filter(p => p.id !== newPost.id)];
    localStorage.setItem(USER_POSTS_KEY, JSON.stringify(updated.slice(0, 30)));
  } catch {}
}

// ---------------------------------------------------------------------------
// 6. BACKEND API SYNC HELPERS (Optimistic + Fire-and-Forget / Sync)
// ---------------------------------------------------------------------------

export async function syncLikeWithServer(postId: string): Promise<{ liked: boolean; likesCount: number } | null> {
  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

export async function syncCommentWithServer(
  postId: string,
  commentText: string,
  replyTo?: string
): Promise<FeedComment | null> {
  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: commentText, replyTo })
    });
    if (res.ok) {
      const data = await res.json();
      return data.comment || null;
    }
  } catch {}
  return null;
}

export async function fetchCommentsFromServer(postId: string): Promise<{ comments: FeedComment[]; stats?: { likes: number; comments: number; views: number } } | null> {
  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments?_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      return {
        comments: data.comments || [],
        stats: data.stats || undefined
      };
    }
  } catch {}
  return null;
}

export async function syncViewWithServer(postId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return data.viewsCount ?? null;
    }
  } catch {}
  return null;
}

export async function syncAdViewWithServer(adId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/ads/${encodeURIComponent(adId)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return data.impressions ?? null;
    }
  } catch {}
  return null;
}

