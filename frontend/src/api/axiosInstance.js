// src/api/axiosInstance.js
import axios from 'axios';

const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
let base = rawBase.replace(/\/+$/, '');          // trim trailing slashes
if (!/\/api(?:\/)?$/.test(base)) base += '/api'; // append /api if missing
base += '/';                                     // ensure single trailing slash

const api = axios.create({
    baseURL: base,
    withCredentials: false,
    // Don't set a global Content-Type: let the browser choose (esp. for FormData)
    timeout: 120000,
});

// ---- token helpers -------------------------------------------------
function readTokens() {
    // Prefer { access, refresh } stored together
    const raw = localStorage.getItem('authTokens');
    if (raw) {
        try {
            const obj = JSON.parse(raw);
            return {access: obj?.access || null, refresh: obj?.refresh || null, raw: obj};
        } catch { /* ignore */
        }
    }
    // Fallback keys if you also store separately
    return {
        access: localStorage.getItem('access_token') || null,
        refresh: localStorage.getItem('refresh_token') || null,
        raw: null,
    };
}

function writeAccessToken(access) {
    const raw = localStorage.getItem('authTokens');
    if (raw) {
        try {
            const obj = JSON.parse(raw) || {};
            obj.access = access;
            localStorage.setItem('authTokens', JSON.stringify(obj));
        } catch { /* ignore */
        }
    }
    localStorage.setItem('access_token', access);
}

// ---- request: attach bearer ---------------------------------------
api.interceptors.request.use((config) => {
    const {access} = readTokens();
    if (access) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${access}`;
    }
    return config;
});

// ---- response: queued refresh -------------------------------------
let isRefreshing = false;
let subscribers = [];

function subscribeTokenRefresh(cb) {
    subscribers.push(cb);
}

function onRefreshed(newAccess) {
    subscribers.forEach((cb) => cb(newAccess));
    subscribers = [];
}

api.interceptors.response.use(
    (resp) => resp,
    async (error) => {
        const {response, config} = error || {};
        if (!response) throw error;

        // Only handle 401 once per request
        if (response.status !== 401 || config.__isRetry) throw error;

        const {refresh} = readTokens();
        if (!refresh) {
            // No refresh token -> bubble up (your auth layer can redirect)
            throw error;
        }

        // Queue retry until a single refresh completes
        if (!isRefreshing) {
            isRefreshing = true;
            try {
                // Use a plain axios call so we don't inject stale Authorization
                const url = base + 'token/refresh/';
                const {data} = await axios.post(url, {refresh}, {headers: {Authorization: undefined}});
                if (!data?.access) throw new Error('No access token in refresh response');

                writeAccessToken(data.access);
                isRefreshing = false;
                onRefreshed(data.access);
            } catch (e) {
                isRefreshing = false;
                onRefreshed(null); // wake subscribers so they can fail fast
                throw e;
            }
        }

        return new Promise((resolve, reject) => {
            subscribeTokenRefresh((newAccess) => {
                if (!newAccess) {
                    reject(error);
                    return;
                }
                try {
                    const retry = {
                        ...config,
                        __isRetry: true,
                        headers: {
                            ...(config.headers || {}),
                            Authorization: `Bearer ${newAccess}`,
                        },
                    };
                    resolve(api(retry));
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
);

export default api;
