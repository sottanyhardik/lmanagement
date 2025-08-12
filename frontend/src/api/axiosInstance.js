// src/api/axiosInstance.js
import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: '/api/',              // ← SAME-ORIGIN (works locally + prod)
    withCredentials: false,        // JWT-only, no cookies
    headers: {'Content-Type': 'application/json'},
});

axiosInstance.interceptors.request.use((config) => {
    const raw = localStorage.getItem('authTokens');
    const access = raw ? JSON.parse(raw)?.access : null;
    if (access) config.headers.Authorization = `Bearer ${access}`;
    return config;
});

export default axiosInstance;
