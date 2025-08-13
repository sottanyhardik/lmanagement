// src/hooks/useChoiceLoader.js
import {useEffect, useMemo, useState} from 'react';
import axios from '../api/axiosInstance';
import {clearEntry, getFromCache, getInflight, resolveInflight, setInflight,} from '../Cache/requestCache';

const ENDPOINT = 'licenses/choices/'; // relies on axiosInstance baseURL (/api/)
const TTL_MS = 10 * 60 * 1000;       // 10 minutes

// ---------- utils ----------
const stableStringify = (obj) =>
    JSON.stringify(obj, Object.keys(obj || {}).sort());

/**
 * Fetch (with cache + inflight de-dupe).
 * @param {{force?: boolean, params?: object, signal?: AbortSignal}} opts
 *  - force: ignore cache and hit network
 *  - params: query params for the endpoint
 *  - signal: optional AbortSignal (hook will pass this)
 */
export async function fetchLicenseChoices({force = false, params = {}, signal} = {}) {
    const cached = getFromCache(ENDPOINT, params, TTL_MS);
    if (!force && cached) return cached;

    const inflight = getInflight(ENDPOINT, params);
    if (inflight) return inflight;

    const req = (async () => {
        try {
            const res = await axios.get(ENDPOINT, {params, signal});
            const data = res?.data ?? {};
            resolveInflight(ENDPOINT, params, data); // also writes to cache in your requestCache
            return data;
        } catch (err) {
            // clear inflight slot on error so future calls can retry
            resolveInflight(ENDPOINT, params, null);
            throw err;
        }
    })();

    setInflight(ENDPOINT, params, req);
    return req;
}

export function clearLicenseChoices(params = {}) {
    clearEntry(ENDPOINT, params);
}

/** Optional: warm the cache early (fire-and-forget) */
export function prefetchLicenseChoices(params = {}) {
    return fetchLicenseChoices({params}).catch(() => {
    });
}

/**
 * React hook to read choices with caching.
 * Returns { choices, loading, error }.
 */
export function useLicenseChoices(params = {}) {
    const key = useMemo(() => stableStringify(params), [params]);
    const initial = getFromCache(ENDPOINT, params, TTL_MS);

    const [state, setState] = useState(() => ({
        choices: initial ?? null,
        loading: !initial,  // loading only if not cached
        error: null,
    }));

    useEffect(() => {
        // If still fresh in cache for these params, no fetch
        if (getFromCache(ENDPOINT, params, TTL_MS)) {
            setState((s) => ({...s, loading: false}));
            return;
        }

        const controller = new AbortController();
        fetchLicenseChoices({params, signal: controller.signal})
            .then((data) => setState({choices: data, loading: false, error: null}))
            .catch((err) => {
                if (controller.signal.aborted) return;
                setState({choices: null, loading: false, error: err});
            });

        return () => controller.abort();
        // key isolates changes to the param *values* (order-insensitive)
    }, [key]);

    return state;
}
