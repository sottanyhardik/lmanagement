// src/context/AuthContext.jsx
import React, {createContext, useCallback, useEffect, useMemo, useRef, useState,} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import {toast} from 'react-toastify';
import axiosInstance from '../api/axiosInstance';

const AuthContext = createContext();

const STORAGE_KEY = 'authTokens';
const SKEW_MS = 30 * 1000;             // refresh a little before expiry
const MIN_REFRESH_MS = 5 * 1000;       // lower bound on refresh delay
const MAX_REFRESH_MS = 10 * 60 * 1000; // upper bound on refresh delay
const INACTIVITY_MS = 2 * 60 * 1000;   // auto-logout after 2 minutes idle

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

    const isAuthenticated = !!user?.exp && Date.now() < user.exp * 1000;

    const scheduleRefresh = useCallback((accessToken) => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
        const payload = safeDecode(accessToken);
        if (!payload?.exp) return;

        const msUntil = payload.exp * 1000 - Date.now() - SKEW_MS;
        const delay = Math.max(MIN_REFRESH_MS, Math.min(MAX_REFRESH_MS, msUntil));

        refreshTimerRef.current = setTimeout(() => {
            void updateToken();
        }, delay);
    }, []);

    const persistTokens = useCallback(
        (tokens) => {
            setAuthTokens(tokens);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
            const decoded = safeDecode(tokens.access);
            setUser(decoded || null);
            if (decoded?.exp) scheduleRefresh(tokens.access);
        },
        [scheduleRefresh]
    );

    const clearTokens = useCallback(() => {
        setAuthTokens(null);
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem(STORAGE_KEY);

        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
    }, []);

    const fetchUserProfile = useCallback(async () => {
        try {
            const {data} = await axiosInstance.get('users/me/');
            setUserProfile(data);
        } catch {
            // ignore
        }
    }, []);

    const logoutUser = useCallback(() => {
        clearTokens();
        // small delay to avoid interfering with current render
        setTimeout(() => navigate('/login', {replace: true}), 0);
    }, [clearTokens, navigate]);

    const updateToken = useCallback(async () => {
        if (!authTokens?.refresh) {
            logoutUser();
            return;
        }

        if (refreshInFlightRef.current) {
            try {
                await refreshInFlightRef.current;
            } catch {
                // if another refresh failed, we’ll handle downstream
            }
            return;
        }

        const doRefresh = (async () => {
            try {
                const {data} = await axiosInstance.post('token/refresh/', {
                    refresh: authTokens.refresh,
                });
                const newTokens = {...authTokens, access: data.access};
                persistTokens(newTokens);
                await fetchUserProfile();
                return newTokens;
            } catch (err) {
                logoutUser(); // ensures redirect to login
                throw err;
            } finally {
                refreshInFlightRef.current = null;
            }
        })();

        refreshInFlightRef.current = doRefresh;
        return doRefresh;
    }, [authTokens, persistTokens, fetchUserProfile, logoutUser]);

    // Global 401 handling with redirect
    useEffect(() => {
        const id = axiosInstance.interceptors.response.use(
            (resp) => resp,
            async (error) => {
                const original = error.config;
                const status = error?.response?.status;

                if (status === 401) {
                    // No refresh token? → logout + redirect
                    if (!authTokens?.refresh) {
                        logoutUser();
                        navigate('/login', {replace: true});
                        return Promise.reject(error);
                    }

                    // Not retried yet → try once
                    if (!original?._retry) {
                        original._retry = true;
                        try {
                            await updateToken();
                            return axiosInstance(original);
                        } catch {
                            logoutUser();
                            navigate('/login', {replace: true});
                            return Promise.reject(error);
                        }
                    }

                    // Already retried → logout + redirect
                    logoutUser();
                    navigate('/login', {replace: true});
                }

                return Promise.reject(error);
            }
        );

        return () => axiosInstance.interceptors.response.eject(id);
    }, [authTokens?.refresh, updateToken, logoutUser, navigate]);

    // Bootstrap tokens on mount
    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        const tokens = raw ? JSON.parse(raw) : null;

        if (tokens?.access) {
            const payload = safeDecode(tokens.access);
            if (payload?.exp && Date.now() < payload.exp * 1000) {
                scheduleRefresh(tokens.access);
                void fetchUserProfile();
            } else if (tokens?.refresh) {
                void updateToken();
            } else {
                clearTokens();
            }
        }

        return () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount only

    // Inactivity timer: reset on activity; logout after INACTIVITY_MS
    const resetInactivityTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
        if (isAuthenticated) {
            inactivityTimerRef.current = setTimeout(() => {
                const idleFor = Date.now() - lastActivityRef.current;
                if (idleFor >= INACTIVITY_MS) {
                    toast.info('You were logged out due to inactivity.');
                    logoutUser();
                }
            }, INACTIVITY_MS);
        }
    }, [isAuthenticated, logoutUser]);

    // Register global activity listeners
    useEffect(() => {
        const handler = () => {
            if (document.hidden) return;
            resetInactivityTimer();
        };
        const events = [
            'mousemove',
            'mousedown',
            'keydown',
            'scroll',
            'touchstart',
            'visibilitychange',
        ];
        events.forEach((e) => window.addEventListener(e, handler, {passive: true}));

        // arm timer initially
        resetInactivityTimer();

        return () => {
            events.forEach((e) => window.removeEventListener(e, handler));
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
        };
    }, [resetInactivityTimer]);

    const loginUser = useCallback(
        async ({username, password}) => {
            if (loading) return;
            setLoading(true);
            try {
                const {data} = await axiosInstance.post('token/', {username, password});
                persistTokens(data);
                await fetchUserProfile();
                resetInactivityTimer();
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
        },
        [loading, persistTokens, fetchUserProfile, resetInactivityTimer, navigate, location.state]
    );

    const value = useMemo(
        () => ({
            user,
            userProfile,
            authTokens,
            isAuthenticated,
            loading,
            loginUser,
            logoutUser,
            refresh: updateToken,
        }),
        [user, userProfile, authTokens, isAuthenticated, loading, loginUser, logoutUser, updateToken]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
