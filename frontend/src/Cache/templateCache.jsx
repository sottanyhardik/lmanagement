// src/utils/templateCache.js
import axios from '../api/axiosInstance';

let cachedTemplates = null;
let cacheTimestamp = 0;
let inFlight = null;

const TTL_MS = 5 * 60 * 1000; // 5 minutes; set to 0 to disable TTL

function isFresh() {
    return cachedTemplates && (Date.now() - cacheTimestamp) < TTL_MS;
}

/**
 * Fetch transfer letter templates with caching, TTL, and request de-duping.
 * @param {Object} opts
 * @param {boolean} opts.force - bypass cache and refetch
 * @returns {Promise<Array>}
 */
export async function fetchTransferLetterTemplates({force = false} = {}) {
    if (!force && isFresh()) return cachedTemplates;

    // Deduplicate concurrent calls
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const res = await axios.get('transfer-letters/');
            const data = res.data?.results || res.data || [];
            cachedTemplates = Array.isArray(data) ? data : [];
            cacheTimestamp = Date.now();
            return cachedTemplates;
        } catch (err) {
            console.error('Failed to fetch transfer letter templates:', err);
            return cachedTemplates ?? [];
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/** Get the cached templates without fetching. */
export function getCachedTemplates() {
    return isFresh() ? cachedTemplates : null;
}

/** Set the cache manually (useful after create/update). */
export function setTemplateCache(templates) {
    cachedTemplates = Array.isArray(templates) ? templates : [];
    cacheTimestamp = Date.now();
}

/** Clear the cache (e.g., on logout). */
export function clearTemplateCache() {
    cachedTemplates = null;
    cacheTimestamp = 0;
    inFlight = null;
}
