/**
 * FOMO Sun — Caching Utilities
 *
 * Provides a generic in-memory cache with TTL and stale-while-revalidate
 * semantics. Designed for Vercel serverless: each cold start gets a fresh
 * cache, but within a warm instance requests share cached data.
 *
 * Strategy:
 * - Weather data (Open-Meteo / MeteoSwiss): 15-min TTL, forecasts don't
 *   change faster than that and the API has a 10k/day rate limit.
 * - SBB / OJP routing: 5-min TTL with SWR — serve stale data instantly
 *   and refresh in the background for the next caller.
 * - Query-level response cache: 15s TTL to collapse concurrent identical
 *   requests from the same slider position.
 */

export interface CacheEntry<T> {
  data: T
  /** Timestamp (ms) when the entry becomes stale. */
  stale_at: number
  /** Timestamp (ms) when the entry expires and must not be served at all. */
  expires_at: number
}

export interface CacheOptions {
  /** How long (ms) the entry is considered fresh. */
  ttl_ms: number
  /**
   * How long (ms) past staleness the entry can still be served while a
   * background revalidation runs. Set to 0 to disable SWR.
   */
  swr_ms?: number
  /** Maximum number of entries before the oldest are evicted. */
  max_entries?: number
}

type RevalidateFn<T> = () => Promise<T>

/**
 * Generic TTL + SWR cache.
 *
 * Usage:
 *   const weatherCache = createCache<WeatherResult>({ ttl_ms: 15 * 60_000 })
 *   const result = await weatherCache.getOrFetch(key, () => fetchWeather(...))
 */
export function createCache<T>(options: CacheOptions) {
  const store = new Map<string, CacheEntry<T>>()
  const inflightRevalidations = new Map<string, Promise<T>>()
  const maxEntries = options.max_entries ?? 2000
  const swrMs = options.swr_ms ?? 0

  /** Evict expired entries when the store exceeds max size. */
  function evict() {
    if (store.size <= maxEntries) return
    const now = Date.now()
    const entries = Array.from(store.entries())
    for (const [key, entry] of entries) {
      if (entry.expires_at <= now) store.delete(key)
      if (store.size <= maxEntries * 0.8) break
    }
    // If still over limit, drop oldest entries by insertion order (Map preserves order).
    if (store.size > maxEntries) {
      const excess = store.size - Math.floor(maxEntries * 0.8)
      const keys = Array.from(store.keys())
      for (let i = 0; i < Math.min(excess, keys.length); i++) {
        store.delete(keys[i])
      }
    }
  }

  function set(key: string, data: T): CacheEntry<T> {
    const now = Date.now()
    const entry: CacheEntry<T> = {
      data,
      stale_at: now + options.ttl_ms,
      expires_at: now + options.ttl_ms + swrMs,
    }
    store.set(key, entry)
    evict()
    return entry
  }

  function get(key: string): CacheEntry<T> | null {
    const entry = store.get(key)
    if (!entry) return null
    if (entry.expires_at <= Date.now()) {
      store.delete(key)
      return null
    }
    return entry
  }

  /**
   * Get cached data or fetch it. Implements stale-while-revalidate:
   * - Fresh entry → return immediately.
   * - Stale but within SWR window → return stale data, trigger background refresh.
   * - Expired or missing → fetch synchronously.
   */
  async function getOrFetch(key: string, fetchFn: RevalidateFn<T>): Promise<T> {
    const entry = get(key)
    const now = Date.now()

    if (entry) {
      if (entry.stale_at > now) {
        // Fresh — return immediately.
        return entry.data
      }

      // Stale but within SWR window — serve stale, revalidate in background.
      if (swrMs > 0 && entry.expires_at > now) {
        if (!inflightRevalidations.has(key)) {
          const revalidation = fetchFn()
            .then(data => {
              set(key, data)
              return data
            })
            .catch(() => entry.data) // On failure, keep serving stale data.
            .finally(() => inflightRevalidations.delete(key))
          inflightRevalidations.set(key, revalidation)
        }
        return entry.data
      }
    }

    // Miss or hard-expired — fetch synchronously.
    // Coalesce concurrent fetches for the same key.
    const inflight = inflightRevalidations.get(key)
    if (inflight) return inflight

    const fetchPromise = fetchFn()
      .then(data => {
        set(key, data)
        return data
      })
      .finally(() => inflightRevalidations.delete(key))

    inflightRevalidations.set(key, fetchPromise)
    return fetchPromise
  }

  function invalidate(key: string) {
    store.delete(key)
  }

  function clear() {
    store.clear()
    inflightRevalidations.clear()
  }

  function size() {
    return store.size
  }

  return { get, set, getOrFetch, invalidate, clear, size }
}

// ── Pre-configured caches for FOMO Sun ──────────────────────────────────

/** Weather forecast cache — 15-minute TTL, no SWR (forecasts are cheap to re-fetch). */
export const weatherCache = createCache<unknown>({
  ttl_ms: 15 * 60_000,
  max_entries: 500,
})

/** SBB/OJP connection cache — 5-min TTL with 10-min SWR window for instant UI. */
export const sbbCache = createCache<unknown>({
  ttl_ms: 5 * 60_000,
  swr_ms: 10 * 60_000,
  max_entries: 300,
})

/** Query-level response cache — 15s TTL to collapse concurrent identical requests. */
export const queryCache = createCache<unknown>({
  ttl_ms: 15_000,
  max_entries: 100,
})
