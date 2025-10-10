// src/utils/requestCache.js
// Reusable cache for GET requests (URL + params). Handles TTL & inflight dedupe.

const STORE = new Map(); // key -> { ts, data, inflight }

function makeKey(url, params = {}) {
    // stable key for url + sorted params
    const ordered = {};
    Object.keys(params).sort().forEach(k => (ordered[k] = params[k]));
    return `${url}?${JSON.stringify(ordered)}`;
}

export function getFromCache(url, params = {}, ttlMs) {
    const key = makeKey(url, params);
    const entry = STORE.get(key);
    if (!entry) return null;
    const {ts, data} = entry;
    if (ttlMs && Date.now() - ts > ttlMs) return null;
    return data;
}

export function getInflight(url, params = {}) {
    const key = makeKey(url, params);
    const entry = STORE.get(key);
    return entry?.inflight || null;
}

export function setInflight(url, params = {}, promise) {
    const key = makeKey(url, params);
    const entry = STORE.get(key) || {};
    entry.inflight = promise;
    STORE.set(key, entry);
}

export function resolveInflight(url, params = {}, data) {
    const key = makeKey(url, params);
    STORE.set(key, {ts: Date.now(), data, inflight: null});
}

export function clearEntry(url, params = {}) {
    const key = makeKey(url, params);
    STORE.delete(key);
}

export function clearAll() {
    STORE.clear();
}
