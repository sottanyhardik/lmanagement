// src/Cache/entityCache.js
import axios from '../api/axiosInstance';

let cachedEntities = null;
let cacheTimestamp = 0;
let inFlight = null;

const TTL_MS = 5 * 60 * 1000; // 5 minutes – tweak as needed

function isFresh() {
    return cachedEntities && (Date.now() - cacheTimestamp) < TTL_MS;
}

/**
 * Fetch invoice entities with in-memory caching, TTL, and request de-duping.
 * @param {Object} opts
 * @param {boolean} opts.force - ignore cache and refetch
 * @returns {Promise<Array>}
 */
export async function fetchEntities({force = false} = {}) {
    // Serve fresh cache
    if (!force && isFresh()) return cachedEntities;

    // De-dupe parallel calls
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const res = await axios.get('invoice-entities/?limit=1000');
            const results =
                res?.data?.results ??
                res?.data ??
                []; // tolerate different shapes

            cachedEntities = Array.isArray(results) ? results : [];
            cacheTimestamp = Date.now();
            return cachedEntities;
        } catch (err) {
            console.error('Failed to fetch invoice entities:', err);
            // On failure, keep old cache if present; otherwise return empty array
            return cachedEntities ?? [];
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/**
 * Return cached entities synchronously (may be null if not loaded).
 */
export function getCachedEntities() {
    return isFresh() ? cachedEntities : null;
}

/**
 * Manually seed/override the cache (useful after create/update flows).
 * @param {Array} entities
 */
export function setEntityCache(entities) {
    cachedEntities = Array.isArray(entities) ? entities : [];
    cacheTimestamp = Date.now();
}

/**
 * Clear the cache (call on logout or when you need a guaranteed refetch).
 */
export function clearEntityCache() {
    cachedEntities = null;
    cacheTimestamp = 0;
    inFlight = null;
}

/**
 * Silently refresh the cache in the background.
 */
export async function primeEntityCache() {
    try {
        await fetchEntities({force: true});
    } catch {
        /* no-op */
    }
}
