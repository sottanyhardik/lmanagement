// src/hooks/useCachedAsyncOptions.js
import {useCallback, useRef} from 'react';
import axios from '../api/axiosInstance.js';

/**
 * Global caches (shared across component instances)
 */
const CACHE = new Map();     // key -> { ts: number, data: any[] }
const INFLIGHT = new Map();  // key -> Promise<any[]>

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

function makeKey(endpoint, params) {
    // Order keys to make stable cache keys
    const ordered = {};
    Object.keys(params || {}).sort().forEach(k => (ordered[k] = params[k]));
    return `${endpoint}?${JSON.stringify(ordered)}`;
}

/**
 * Generic, debounced, cached async loader.
 * Returns a function(inputValue) -> Promise<option[]>
 */
export function useCachedAsyncOptions({
                                          endpoint,
                                          /**
                                           * Convert raw item -> { value, label, data }
                                           */
                                          toOption,
                                          /**
                                           * How to read items from a server response
                                           * (defaults to data.results || data || [])
                                           */
                                          extractItems = (data) => Array.isArray(data?.results) ? data.results : (data || []),
                                          /**
                                           * Map of extra query params (object or function(inputValue) -> object)
                                           */
                                          extraParams = {},
                                          /**
                                           * Name of the query parameter for search (e.g., "search", "display_name")
                                           */
                                          searchParam = 'search',
                                          /**
                                           * Minimum characters before firing search (ignored when defaultOptions===true)
                                           */
                                          minChars = 2,
                                          /**
                                           * Debounce duration for keystrokes
                                           */
                                          debounceMs = 300,
                                          /**
                                           * Cache time-to-live
                                           */
                                          ttl = DEFAULT_TTL,
                                          /**
                                           * Whether to dedupe duplicate options by value
                                           */
                                          dedupe = true,
                                          /**
                                           * If true, allow initial fetch with empty input (server should support)
                                           */
                                          defaultOptions = false,
                                      }) {
    const timerRef = useRef(null);

    const load = useCallback((inputValueRaw) => {
        const inputValue = (inputValueRaw ?? '').trim();

        // Debounce wrapper: return a promise that resolves after delay
        return new Promise((resolve) => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(async () => {
                try {
                    // Guard by minChars unless defaultOptions is enabled
                    if (!defaultOptions && (!inputValue || inputValue.length < minChars)) {
                        resolve([]);
                        return;
                    }

                    const extras = typeof extraParams === 'function' ? extraParams(inputValue) : (extraParams || {});
                    const params = {...extras};
                    if (searchParam && (defaultOptions ? inputValue.length >= 0 : inputValue.length >= minChars)) {
                        // Only include searchParam when typing, or always if server allows blank search
                        params[searchParam] = inputValue;
                    }

                    const key = makeKey(endpoint, params);

                    // Serve from valid cache
                    const hit = CACHE.get(key);
                    if (hit && (Date.now() - hit.ts) < ttl) {
                        const opts = toOptions(hit.data, toOption, dedupe);
                        resolve(opts);
                        return;
                    }

                    // Deduplicate inflight
                    if (INFLIGHT.has(key)) {
                        const inflight = await INFLIGHT.get(key);
                        resolve(toOptions(inflight, toOption, dedupe));
                        return;
                    }

                    // Issue request
                    const req = axios.get(endpoint, {params})
                        .then(({data}) => extractItems(data))
                        .catch((err) => {
                            console.error(`Failed to load options for ${endpoint}`, err);
                            return [];
                        })
                        .finally(() => {
                            INFLIGHT.delete(key);
                        });

                    INFLIGHT.set(key, req);
                    const items = await req;

                    // Write cache
                    CACHE.set(key, {ts: Date.now(), data: items});

                    resolve(toOptions(items, toOption, dedupe));
                } catch (e) {
                    console.error('useCachedAsyncOptions unexpected error:', e);
                    resolve([]);
                }
            }, debounceMs);
        });
    }, [endpoint, toOption, extractItems, extraParams, searchParam, minChars, debounceMs, ttl, dedupe, defaultOptions]);

    return load;
}

function toOptions(items, toOption, dedupe) {
    const mapped = (items || []).map(toOption).filter(Boolean);
    if (!dedupe) return mapped;
    const seen = new Set();
    const out = [];
    for (const opt of mapped) {
        const key = String(opt?.value ?? '');
        if (key && !seen.has(key)) {
            seen.add(key);
            out.push(opt);
        }
    }
    return out;
}
