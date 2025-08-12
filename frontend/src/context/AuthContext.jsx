import React, {createContext, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import {toast} from 'react-toastify';
import axiosInstance from '../api/axiosInstance';

const AuthContext = createContext();

const STORAGE_KEY = 'authTokens';
const SKEW_MS = 30 * 1000;
const MIN_REFRESH_MS = 5 * 1000;
const MAX_REFRESH_MS = 10 * 60 * 1000;

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
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
    }, []);

    const fetchUserProfile = useCallback(async () => {
        try {
            // baseURL = '/api/' → this hits '/api/users/me/'
            const {data} = await axiosInstance.get('users/me/');
            setUserProfile(data);
        } catch {
        }
    }, []);

    const loginUser = useCallback(async ({username, password}) => {
        if (loading) return;
        setLoading(true);
        try {
            // baseURL = '/api/' → this hits '/api/token/'
            const {data} = await axiosInstance.post('token/', {username, password});
            persistTokens(data);
            await fetchUserProfile();
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, {replace: true});
        } catch (error) {
            const status = error?.response?.status;
            const msg =
                error?.response?.data?.detail ||
                error?.response?.data?.error ||
                (status === 401 ? 'Invalid username or password' : 'Login failed');
            toast.error(`❌ ${msg}`);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [loading, persistTokens, fetchUserProfile, navigate, location.state]);

    const logoutUser = useCallback(() => {
        clearTokens();
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
            }
            return;
        }

        const doRefresh = (async () => {
            try {
                // baseURL = '/api/' → this hits '/api/token/refresh/'
                const {data} = await axiosInstance.post('token/refresh/', {refresh: authTokens.refresh});
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

    useEffect(() => {
        const id = axiosInstance.interceptors.response.use(
            (resp) => resp,
            async (error) => {
                const original = error.config;
                const status = error?.response?.status;
                if (status === 401 && !original?._retry && authTokens?.refresh) {
                    original._retry = true;
                    try {
                        await updateToken();
                        return axiosInstance(original);
                    } catch {
                    }
                }
                return Promise.reject(error);
            }
        );
        return () => axiosInstance.interceptors.response.eject(id);
    }, [authTokens?.refresh, updateToken]);

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
    }, []); // intentionally only on mount

    const value = useMemo(() => ({
        user,
        userProfile,
        authTokens,
        isAuthenticated,
        loading,
        loginUser,
        logoutUser,
        refresh: updateToken,
    }), [user, userProfile, authTokens, isAuthenticated, loading, loginUser, logoutUser, updateToken]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
