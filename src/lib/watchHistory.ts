/**
 * LocalNet Watch History & Interest Profile
 * Tracks what videos users have seen (for deduplication) and builds
 * a taste profile from engagement signals (for personalized sorting).
 */

import { Post } from '../types/index.ts';
import { getCurrentUserId } from './engagementStorage.ts';

function getSeenKey()      { return `localnet_seen_v3_${getCurrentUserId()}`; }
function getInterestsKey() { return `localnet_interests_v3_${getCurrentUserId()}`; }

const MAX_SEEN = 1000; // max video IDs stored per user

// ── Watch History ─────────────────────────────────────────────────────────

export function getSeenVideoIds(): Set<string> {
  try {
    const raw = localStorage.getItem(getSeenKey());
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

/** Call when a video has been watched for ≥ 3 seconds */
export function markVideoSeen(postId: string): void {
  try {
    const seen = getSeenVideoIds();
    seen.add(postId);
    // Keep only the most recent MAX_SEEN entries
    const arr = Array.from(seen).slice(-MAX_SEEN);
    localStorage.setItem(getSeenKey(), JSON.stringify(arr));
  } catch {}
}

export function isVideoSeen(postId: string): boolean {
  return getSeenVideoIds().has(postId);
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(getSeenKey());
    localStorage.removeItem(getInterestsKey());
  } catch {}
}

// ── Interest Profile ───────────────────────────────────────────────────────

// How much each engagement action influences the interest score
const ACTION_WEIGHTS: Record<string, number> = {
  view:     0.2,   // video scrolled past and briefly visible
  watch3:   0.5,   // watched ≥ 3 seconds (feeds "seen" mark too)
  watch50:  1.5,   // watched ≥ 50%
  watch100: 3.0,   // watched the whole thing
  like:     3.0,   // explicitly liked
  save:     2.5,   // bookmarked
  share:    2.0,   // shared
  comment:  2.5,   // left a comment
};

export function getInterestProfile(): Record<string, number> {
  try {
    const raw = localStorage.getItem(getInterestsKey());
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function updateInterests(
  post: { id: string; creatorHandle?: string; creatorId?: string; tags?: string[]; title?: string },
  action: string
): void {
  const weight = ACTION_WEIGHTS[action] ?? 0.5;
  if (weight === 0) return;

  try {
    const profile = getInterestProfile();

    // Creator boost
    const creatorKey = `creator:${post.creatorHandle || post.creatorId || 'unknown'}`;
    profile[creatorKey] = (profile[creatorKey] || 0) + weight;

    // Tag boosts
    for (const tag of (post.tags || []).slice(0, 8)) {
      const tagKey = `tag:${tag.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      profile[tagKey] = (profile[tagKey] || 0) + weight * 0.5;
    }

    // Title keyword boosts (simple extraction)
    const STOP_WORDS = new Set(['and','the','with','for','this','that','from','have','will','was','are','you','your','into']);
    const titleWords = (post.title || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
      .slice(0, 5);
    for (const word of titleWords) {
      const wordKey = `word:${word}`;
      profile[wordKey] = (profile[wordKey] || 0) + weight * 0.3;
    }

    // Keep only top 200 keys
    const sorted = Object.entries(profile)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 200);
    localStorage.setItem(getInterestsKey(), JSON.stringify(Object.fromEntries(sorted)));
  } catch {}
}

// ── Scoring ────────────────────────────────────────────────────────────────

/** Score a post against the user's interest profile. Higher = more relevant. */
export function scorePost(post: Post): number {
  const profile = getInterestProfile();
  let score = 0;

  // Creator affinity
  const creatorKey = `creator:${post.creatorHandle || post.creatorId || ''}`;
  score += (profile[creatorKey] || 0) * 3;

  // Tag affinity
  for (const tag of (post.tags || [])) {
    const tagKey = `tag:${tag.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    score += (profile[tagKey] || 0) * 2;
  }

  // Title keyword affinity
  const words = (post.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
  for (const word of words) {
    score += (profile[`word:${word}`] || 0);
  }

  // Recency bonus (fresh content gets a head start)
  const ageHours = (Date.now() - new Date(post.createdAt || 0).getTime()) / 3_600_000;
  if (ageHours < 24)       score += 15;
  else if (ageHours < 72)  score += 8;
  else if (ageHours < 168) score += 3;

  // Light popularity signal
  score += Math.log1p((post.stats?.likes || 0) + (post.stats?.views || 0) / 100) * 0.5;

  return score;
}

// ── Session Shuffle Seed ───────────────────────────────────────────────────
// Changes on every feed refresh so unseen posts appear in a different order
// while still respecting interest scores.
let _sessionSeed = Math.random();

/** Call this every time the feed is refreshed (pull-to-refresh or app open) */
export function refreshSessionSeed(): void {
  _sessionSeed = Math.random();
}

export function getSessionSeed(): number { return _sessionSeed; }

/**
 * Sort posts for the feed:
 *   1. Unseen posts first, sorted by interest score + random session jitter
 *   2. Already-seen posts last (in case user wants to rewatch)
 *
 * The random jitter means that on every refresh the order is different,
 * even when interest scores are close — so the feed never feels stale.
 */
export function sortFeedByRelevance(posts: Post[]): Post[] {
  const seen = getSeenVideoIds();

  const unseen  = posts.filter(p => !seen.has(p.id));
  const watched = posts.filter(p =>  seen.has(p.id));

  /** Combined score: interest + session-varied shuffle component */
  const finalScore = (p: Post): number => {
    const interest = scorePost(p);
    // Deterministic jitter per (post, session): same post gets a different
    // rank every session, but within a session the order is stable.
    const postHash = p.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const jitter = ((postHash * _sessionSeed * 1000) % 8); // 0–8 range
    return interest + jitter;
  };

  unseen.sort( (a, b) => finalScore(b) - finalScore(a));
  watched.sort((a, b) => finalScore(b) - finalScore(a));

  return [...unseen, ...watched];
}

/** Returns how many unseen videos are in a post list */
export function countUnseenPosts(posts: Post[]): number {
  const seen = getSeenVideoIds();
  return posts.filter(p => !seen.has(p.id)).length;
}
