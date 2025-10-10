import React, {createContext, useCallback, useEffect, useMemo, useRef, useState,} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import {toast} from 'react-toastify';
import api, {markUserActivity} from '../api/axiosInstance';

const AuthContext = createContext();

/** Storage keys shared with axiosInstance */
const STORAGE_KEY = 'authTokens';
const LAST_ACTIVE_KEY = 'lastActiveAt';

/** Refresh timing */
const SKEW_MS = 30 * 1000;
const MIN_REFRESH_MS = 5 * 1000;
const MAX_REFRESH_MS = 10 * 60 * 1000;

/** Activity-driven refresh threshold */
const ACTIVITY_REFRESH_WINDOW_MS = 60 * 1000;

/** Inactivity (must match axiosInstance’s limit) */
const INACTIVITY_MS = 15 * 60 * 1000;

function safeDecode(token) {
    try {
        return jwtDecode(token);
    } catch {
        return null;
    }
}

export const AuthProvider = ({children}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [authTokens, setAuthTokens] = useState(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    });

    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        const access = raw ? JSON.parse(raw)?.access : null;
        return access ? safeDecode(access) : null;
    });

    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(false);

    const refreshTimerRef = useRef(null);
    const refreshInFlightRef = useRef(null);

    const inactivityTimerRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    // Debounce lock for activity-triggered refresh
    const activityRefreshLockRef = useRef(false);
    const unlockActivityRefreshRef = useRef(null);

    // Ref to the latest updateToken function (breaks closure cycles)
    const updateTokenRef = useRef(() => Promise.resolve());

    const isAuthenticated = !!user?.exp && Date.now() < user.exp * 1000;

    /* ======================= Token persistence + refresh ====================== */

    const clearRefreshTimer = useCallback(() => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
    }, []);

    const scheduleRefresh = useCallback((accessToken) => {
        clearRefreshTimer();

        const payload = safeDecode(accessToken);
        if (!payload?.exp) return;

        const msUntil = payload.exp * 1000 - Date.now() - SKEW_MS;
        const delay = Math.max(MIN_REFRESH_MS, Math.min(MAX_REFRESH_MS, msUntil));

        refreshTimerRef.current = setTimeout(() => {
            const fn = updateTokenRef.current;
            if (typeof fn === 'function') {
                // Avoid unhandled promise rejections in console
                void fn().catch(() => {
                });
            }
        }, delay);
    }, [clearRefreshTimer]);

    const persistTokens = useCallback((tokens) => {
        setAuthTokens(tokens);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
        const decoded = safeDecode(tokens.access);
        setUser(decoded || null);
        if (decoded?.exp) scheduleRefresh(tokens.access);
    }, [scheduleRefresh]);

    const clearTokens = useCallback(() => {
        setAuthTokens(null);
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem(STORAGE_KEY);
        clearRefreshTimer();
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
    }, [clearRefreshTimer]);

    const fetchUserProfile = useCallback(async () => {
        try {
            const {data} = await api.get('users/me/');
            setUserProfile(data);
        } catch {
            // ignore profile fetch errors
        }
    }, []);

    const logoutUser = useCallback(() => {
        clearTokens();
        // small delay to avoid interfering with current render
        setTimeout(() => navigate('/login', {replace: true}), 0);
    }, [clearTokens, navigate]);

    const updateToken = useCallback(async () => {
        const refresh = authTokens?.refresh;
        if (!refresh) {
            logoutUser();
            return;
        }

        if (refreshInFlightRef.current) {
            try {
                await refreshInFlightRef.current;
            } catch {
                // the global handlers handle logout; just stop here
            }
            return;
        }

        const doRefresh = (async () => {
            try {
                const {data} = await api.post('token/refresh/', {refresh});
                const newTokens = {...authTokens, access: data.access};
                persistTokens(newTokens);
                await fetchUserProfile();
                return newTokens;
            } catch (err) {
                logoutUser();
                throw err;
            } finally {
                refreshInFlightRef.current = null;
            }
        })();

        refreshInFlightRef.current = doRefresh;
        return doRefresh;
    }, [authTokens, persistTokens, fetchUserProfile, logoutUser]);

    // Keep the ref pointing at the latest updateToken
    useEffect(() => {
        updateTokenRef.current = updateToken;
    }, [updateToken]);

    /* ============================= Bootstrap flow ============================= */
    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        const tokens = raw ? JSON.parse(raw) : null;

        if (tokens?.access) {
            const payload = safeDecode(tokens.access);
            if (payload?.exp && Date.now() < payload.exp * 1000) {
                scheduleRefresh(tokens.access);
                void fetchUserProfile();
            } else if (tokens?.refresh) {
                void updateTokenRef.current?.().catch(() => {
                });
            } else {
                clearTokens();
            }
        }

        return () => {
            clearRefreshTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount only

    /* ========================= Inactivity auto-logout ========================= */
    const armInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (!isAuthenticated) return;

        inactivityTimerRef.current = setTimeout(() => {
            const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
            const idleFor = Date.now() - last;
            if (idleFor >= INACTIVITY_MS) {
                toast.info('You were logged out due to inactivity.');
                logoutUser();
            } else {
                armInactivityTimer(); // re-arm
            }
        }, INACTIVITY_MS);
    }, [isAuthenticated, logoutUser]);

    const shouldRefreshSoon = useCallback(() => {
        if (!isAuthenticated || !user?.exp) return false;
        const now = Date.now();
        const expMs = user.exp * 1000;
        const timeLeft = expMs - now;
        return timeLeft <= (ACTIVITY_REFRESH_WINDOW_MS + SKEW_MS);
    }, [isAuthenticated, user?.exp]);

    const recordActivity = useCallback(() => {
        if (document.hidden) return;
        lastActivityRef.current = Date.now();
        try {
            markUserActivity();
        } catch {
            try {
                localStorage.setItem(LAST_ACTIVE_KEY, String(lastActivityRef.current));
            } catch {
            }
        }
        armInactivityTimer();

        // Proactive refresh when token is about to expire soon
        if (shouldRefreshSoon()) {
            if (!activityRefreshLockRef.current) {
                activityRefreshLockRef.current = true;
                void updateTokenRef.current?.().catch(() => {
                });
                // unlock after ~30s to avoid spamming refresh on rapid activity
                const unlock = setTimeout(() => {
                    activityRefreshLockRef.current = false;
                    unlockActivityRefreshRef.current = null;
                }, 30 * 1000);
                unlockActivityRefreshRef.current = unlock;
            }
        }
    }, [armInactivityTimer, shouldRefreshSoon]);

    useEffect(() => {
        // Initialize baseline + timer
        try {
            const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
            const now = Date.now();
            if (!last) localStorage.setItem(LAST_ACTIVE_KEY, String(now));
            if (now - last >= INACTIVITY_MS && isAuthenticated) {
                toast.info('You were logged out due to inactivity.');
                logoutUser();
            } else {
                lastActivityRef.current = last || now;
                armInactivityTimer();
            }
        } catch {
            armInactivityTimer();
        }

        // Local activity
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
        const handler = () => recordActivity();
        events.forEach((e) => window.addEventListener(e, handler, {passive: true}));

        // Cross-tab sync
        const onStorage = (e) => {
            if (e.key === LAST_ACTIVE_KEY && !document.hidden) {
                lastActivityRef.current = Number(e.newValue || Date.now());
                armInactivityTimer();
            }
        };
        window.addEventListener('storage', onStorage);

        return () => {
            events.forEach((e) => window.removeEventListener(e, handler));
            window.removeEventListener('storage', onStorage);
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
            if (unlockActivityRefreshRef.current) {
                clearTimeout(unlockActivityRefreshRef.current);
                unlockActivityRefreshRef.current = null;
            }
        };
    }, [recordActivity, armInactivityTimer, isAuthenticated, logoutUser]);

    // Global session events from axiosInstance
    useEffect(() => {
        const onSessionLogout = (e) => {
            const reason = e?.detail?.reason || 'idle';
            if (reason === 'idle') toast.info('You were logged out due to inactivity.');
            logoutUser();
        };

        const onUnhandled = (e) => {
            // Suppress console noise for our intentional idle rejection.
            if (e?.reason?.code === 'ERR_SESSION_EXPIRED' || e?.reason?.__idle) {
                e?.preventDefault?.();
                // session:logout event already handled logout/toast
            }
        };

        window.addEventListener('session:logout', onSessionLogout);
        window.addEventListener('unhandledrejection', onUnhandled);
        return () => {
            window.removeEventListener('session:logout', onSessionLogout);
            window.removeEventListener('unhandledrejection', onUnhandled);
        };
    }, [logoutUser]);

    /* ================================ Login API =============================== */
    const loginUser = useCallback(async ({username, password}) => {
        if (loading) return;
        setLoading(true);
        try {
            const {data} = await api.post('token/', {username, password});
            persistTokens(data);
            await fetchUserProfile();
            // Reset activity baseline
            try {
                markUserActivity();
            } catch {
                try {
                    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
                } catch {
                }
            }
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, {replace: true});
        } catch (error) {
            const status = error?.response?.status;
            const msg =
                error?.response?.data?.detail ||
                error?.response?.data?.error ||
                (status === 401 ? 'Invalid username or password' : 'Auth failed');
            toast.error(`❌ ${msg}`);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [loading, persistTokens, fetchUserProfile, navigate, location.state]);

    /* ================================== Value ================================= */
    const value = useMemo(() => ({
        user,
        userProfile,
        authTokens,
        isAuthenticated,
        loading,
        loginUser,
        logoutUser,
        refresh: updateTokenRef.current,

        inactivityMs: INACTIVITY_MS,
        lastActiveKey: LAST_ACTIVE_KEY,
    }), [user, userProfile, authTokens, isAuthenticated, loading, loginUser, logoutUser]);

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

export default AuthContext;