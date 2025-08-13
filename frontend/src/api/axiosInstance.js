// src/api/axiosInstance.js
import axios from 'axios';


const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const axiosInstance = axios.create({
    baseURL: `${apiBase.replace(/\/$/, '')}/api/`, // ensures single slash
    withCredentials: false,      // using JWT in Authorization header
    headers: {'Content-Type': 'application/json'},
    timeout: 30000,              // 30s network timeout (tweak if needed)
});

// Attach Bearer token if present
axiosInstance.interceptors.request.use((config) => {
    const raw = localStorage.getItem('authTokens');
    const access = raw ? JSON.parse(raw)?.access : null;
    if (access) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${access}`;
    }
    return config;
});

export default axiosInstance;
