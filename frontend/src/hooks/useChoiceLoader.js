// src/hooks/useChoiceLoader.js
import {useEffect, useMemo, useState} from "react";
import axios from "../api/axiosInstance";
import {clearEntry, getFromCache, getInflight, resolveInflight, setInflight,} from "../Cache/requestCache";

const ENDPOINT = "choices/"; // served from /api/choices/
const TTL_MS = 10 * 60 * 1000; // 10 min cache

const stableStringify = (obj) =>
    JSON.stringify(obj, Object.keys(obj || {}).sort());

export async function fetchLicenseChoices({force = false, params = {}, signal} = {}) {
    const cached = getFromCache(ENDPOINT, params, TTL_MS);
    if (!force && cached) return cached;

    const inflight = getInflight(ENDPOINT, params);
    if (inflight) return inflight;

    const req = (async () => {
        try {
            const res = await axios.get(ENDPOINT, {params, signal});
            const data = res?.data ?? {};
            resolveInflight(ENDPOINT, params, data); // also caches
            return data;
        } catch (err) {
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

export function prefetchLicenseChoices(params = {}) {
    return fetchLicenseChoices({params}).catch(() => {
    });
}

export function useLicenseChoices(params = {}, opts = {}) {
    const {force = false} = opts;
    const key = useMemo(() => stableStringify(params), [params]);
    const initial = getFromCache(ENDPOINT, params, TTL_MS);

    const [state, setState] = useState(() => ({
        choices: initial ?? null,
        loading: !initial,
        error: null,
    }));

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        if (!force && initial) {
            setState((s) => ({...s, loading: false}));
            return;
        }

        fetchLicenseChoices({force, params, signal: controller.signal})
            .then((data) => {
                if (!cancelled) setState({choices: data, loading: false, error: null});
            })
            .catch((err) => {
                if (!cancelled) {
                    setState((s) => ({
                        ...s,
                        loading: false,
                        error: err?.message || String(err),
                    }));
                }
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [key, force]);

    const refetch = (extra = {}) =>
        fetchLicenseChoices({force: true, params: {...params, ...extra}})
            .then((data) => setState({choices: data, loading: false, error: null}))
            .catch((err) =>
                setState((s) => ({
                    ...s,
                    loading: false,
                    error: err?.message || String(err),
                }))
            );

    return {...state, refetch};
}
