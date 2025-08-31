// src/api/axiosInstance.js
import axios from 'axios';

/* ================================= Base URL ================================= */
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

/* ====================== Shared refresh state (declare early) ====================== */
// Must live above anything that could call forceLogout()
let isRefreshing = false;
let subscribers = [];

/** Subscribe a callback to be called once a refresh attempt resolves. */
function subscribeTokenRefresh(cb) {
    subscribers.push(cb);
}

/** Notify all subscribers with the new access token (or null on failure). */
function onRefreshed(newAccess) {
    subscribers.forEach((cb) => {
        try {
            cb(newAccess);
        } catch { /* no-op */
        }
    });
    subscribers = [];
}

/* ================================================================================ */

/* ========================= Inactivity (15 minutes) ========================= */
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const LAST_ACTIVE_KEY = 'lastActiveAt';
const LOGOUT_REASON_KEY = 'logoutReason';

let logoutHandler = null; // optional callback for app-level handling

export function setLogoutHandler(fn) {
    logoutHandler = typeof fn === 'function' ? fn : null;
}

function nowMs() {
    return Date.now();
}

function readLastActive() {
    return Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
}

function writeLastActive(ts = nowMs()) {
    localStorage.setItem(LAST_ACTIVE_KEY, String(ts));
}

export function markUserActivity() {
    writeLastActive();
}

function clearTokensStorage() {
    localStorage.removeItem('authTokens');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
}

/** Forcefully log out and notify listeners. */
function forceLogout(reason = 'idle') {
    try {
        sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
    } catch { /* no-op */
    }

    clearTokensStorage();

    // Wake any refresh waiters (fail them fast). Safe because declared above.
    isRefreshing = false;
    onRefreshed(null);

    // Broadcast to the app
    try {
        window.dispatchEvent(new CustomEvent('session:logout', {detail: {reason}}));
    } catch { /* no-op */
    }

    if (logoutHandler) {
        try {
            logoutHandler(reason);
        } catch { /* no-op */
        }
    }
}

// Initialize activity listeners (once, in browser only)
if (typeof window !== 'undefined') {
    // Baseline on first load
    if (!readLastActive()) writeLastActive();

    const onActivity = () => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
            writeLastActive();
        }
    };

    [
        'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown',
        'focus', 'visibilitychange',
    ].forEach((ev) => window.addEventListener(ev, onActivity, {passive: true}));

    // If tab loads after long idle, logout immediately
    if (nowMs() - readLastActive() >= INACTIVITY_LIMIT_MS) {
        forceLogout('idle');
    }
}
/* ========================================================================== */

/* ============================== Token helpers ============================== */
function readTokens() {
    const raw = localStorage.getItem('authTokens');
    if (raw) {
        try {
            const obj = JSON.parse(raw);
            return {access: obj?.access || null, refresh: obj?.refresh || null, raw: obj};
        } catch { /* ignore */
        }
    }
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

/* ========================================================================== */

/* =========================== Request interceptor =========================== */
api.interceptors.request.use(
    (config) => {
        // Hard-stop requests if session is idle-expired
        const last = readLastActive();
        if (nowMs() - last >= INACTIVITY_LIMIT_MS) {
            forceLogout('idle');
            const err = new Error('Session expired due to inactivity');
            err.code = 'ERR_SESSION_EXPIRED';
            return Promise.reject(err);
        }

        // Mark activity on outgoing requests
        writeLastActive();

        // Attach access token, if any
        const {access} = readTokens();
        if (access) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${access}`;
        }

        return config;
    },
    (err) => Promise.reject(err)
);
/* ========================================================================== */

/* =========================== Response interceptor ========================== */
api.interceptors.response.use(
    (resp) => resp,
    async (error) => {
        // Pass through if there's no response (network/CORS/etc.)
        const {response, config} = error || {};
        if (!response || !config) throw error;

        // If idle-expired mid-flight, do not attempt refresh
        if (nowMs() - readLastActive() >= INACTIVITY_LIMIT_MS) {
            forceLogout('idle');
            throw error;
        }

        // Only handle 401 once per request
        if (response.status !== 401 || config.__isRetry) throw error;

        const {refresh} = readTokens();
        if (!refresh) {
            // No refresh token -> bubble up; app will redirect
            throw error;
        }

        // Queue retry until a single refresh completes
        if (!isRefreshing) {
            isRefreshing = true;
            try {
                // Use plain axios to avoid stale Authorization header
                const url = base + 'token/refresh/';
                const {data} = await axios.post(
                    url,
                    {refresh},
                    {headers: {Authorization: undefined}}
                );

                if (!data?.access) throw new Error('No access token in refresh response');

                writeAccessToken(data.access);
                isRefreshing = false;
                onRefreshed(data.access);
            } catch (e) {
                isRefreshing = false;
                onRefreshed(null); // wake subscribers to fail fast
                forceLogout('refresh_failed');
                throw e;
            }
        }

        // Subscribe to the refresh result and retry on success
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
/* ========================================================================== */

export default api;
