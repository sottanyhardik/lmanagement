import axios from 'axios';

/* ================================= Base URL ================================= */
const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
let base = rawBase.replace(/\/+$/, '');
if (!/\/api(?:\/)?$/.test(base)) base += '/api';
base += '/';

const api = axios.create({
    baseURL: base,
    withCredentials: false,
    timeout: 120000,
});

/* ====================== Shared refresh state (declare early) ====================== */
let isRefreshing = false;
let subscribers = [];

function subscribeTokenRefresh(cb) {
    subscribers.push(cb);
}

function onRefreshed(newAccess) {
    subscribers.forEach((cb) => {
        try {
            cb(newAccess);
        } catch {
        }
    });
    subscribers = [];
}

/* ================================================================================ */

/* ========================= Inactivity (15 minutes) ========================= */
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const LAST_ACTIVE_KEY = 'lastActiveAt';
const LOGOUT_REASON_KEY = 'logoutReason';

let logoutHandler = null; // optional app callback

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
    } catch {
    }
    clearTokensStorage();

    // Wake any refresh waiters (fail fast)
    isRefreshing = false;
    onRefreshed(null);

    try {
        window.dispatchEvent(new CustomEvent('session:logout', {detail: {reason}}));
    } catch {
    }
    if (logoutHandler) {
        try {
            logoutHandler(reason);
        } catch {
        }
    }
}

// Initialize activity listeners (browser only)
if (typeof window !== 'undefined') {
    if (!readLastActive()) writeLastActive();

    const onActivity = () => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
            writeLastActive();
        }
    };

    [
        'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart',
        'pointerdown', 'focus', 'visibilitychange',
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
        } catch {
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
        } catch {
        }
    }
    localStorage.setItem('access_token', access);
}

/* ========================================================================== */

/* =========================== Request interceptor =========================== */
api.interceptors.request.use(
    (config) => {
        const last = readLastActive();
        if (nowMs() - last >= INACTIVITY_LIMIT_MS) {
            // Proactively end the session and reject with a tagged error.
            forceLogout('idle');
            const err = new Error('Session expired due to inactivity');
            err.code = 'ERR_SESSION_EXPIRED';
            // Tag so a global unhandledrejection handler can suppress console noise.
            err.__idle = true;
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
        if (!refresh) throw error;

        // Single refresh in flight; queue others
        if (!isRefreshing) {
            isRefreshing = true;
            try {
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
                onRefreshed(null);
                forceLogout('refresh_failed');
                throw e;
            }
        }

        // Retry subscribers after refresh
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
                        headers: {...(config.headers || {}), Authorization: `Bearer ${newAccess}`},
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
