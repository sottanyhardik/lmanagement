// src/hooks/useChoiceLoader.js
import {useEffect, useMemo, useState} from "react";
import axios from "../api/axiosInstance";

const ENDPOINT = "choices/"; // served from /api/choices/

const stableStringify = (obj) =>
    JSON.stringify(obj, Object.keys(obj || {}).sort());

/**
 * Simple fetcher – no cache, no inflight dedupe.
 */
export async function fetchLicenseChoices({params = {}, signal} = {}) {
    const res = await axios.get(ENDPOINT, {params, signal});
    return res?.data ?? {};
}

/**
 * No-ops kept for compatibility where these functions are imported.
 */
export function clearLicenseChoices() {
}

export function prefetchLicenseChoices() {
}

/**
 * Hook – no cache. Fetches on mount and whenever params change.
 */
export function useLicenseChoices(params = {}, _opts = {}) {
    const key = useMemo(() => stableStringify(params), [params]);

    const [state, setState] = useState({
        choices: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        setState((s) => ({...s, loading: true, error: null}));

        fetchLicenseChoices({params, signal: controller.signal})
            .then((data) => {
                if (!cancelled) setState({choices: data, loading: false, error: null});
            })
            .catch((err) => {
                if (!cancelled) {
                    setState({
                        choices: null,
                        loading: false,
                        error: err?.message || String(err),
                    });
                }
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [key]);

    const refetch = (extra = {}) => {
        setState((s) => ({...s, loading: true, error: null}));
        return fetchLicenseChoices({params: {...params, ...extra}})
            .then((data) => setState({choices: data, loading: false, error: null}))
            .catch((err) =>
                setState((s) => ({
                    ...s,
                    loading: false,
                    error: err?.message || String(err),
                }))
            );
    };

    return {...state, refetch};
}
