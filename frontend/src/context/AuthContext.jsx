import React, {createContext, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import {toast} from 'react-toastify';
import axiosInstance from '../api/axiosInstance';

const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [authTokens, setAuthTokens] = useState(() =>
        localStorage.getItem('authTokens')
            ? JSON.parse(localStorage.getItem('authTokens'))
            : null
    );

    const [user, setUser] = useState(() =>
        localStorage.getItem('authTokens')
            ? jwtDecode(JSON.parse(localStorage.getItem('authTokens')).access)
            : null
    );

    const [userProfile, setUserProfile] = useState(null);
    const navigate = useNavigate();

    const fetchUserProfile = async () => {
        try {
            const response = await axiosInstance.get('/api/users/me/');
            setUserProfile(response.data);
        } catch (error) {
            console.error('❌ Failed to fetch user profile:', error.response?.data || error.message);
        }
    };

    const loginUser = async ({username, password}) => {
        try {
            const response = await axiosInstance.post('/api/token/', {username, password});

            const data = response.data;
            setAuthTokens(data);
            setUser(jwtDecode(data.access));
            localStorage.setItem('authTokens', JSON.stringify(data));

            await fetchUserProfile();
            navigate('/dashboard');
        } catch (error) {
            const status = error.response?.status;
            if (status === 401) {
                toast.error('❌ Invalid username or password');
            } else {
                toast.error('❌ Login failed');
            }
        }
    };

    const logoutUser = () => {
        setAuthTokens(null);
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem('authTokens');
        setTimeout(() => navigate('/login', {replace: true}), 0);
    };

    const updateToken = async () => {
        if (!authTokens?.refresh) return;

        try {
            const response = await axiosInstance.post('/api/token/refresh/', {
                refresh: authTokens.refresh,
            });

            const data = response.data;
            const newTokens = {...authTokens, access: data.access};
            setAuthTokens(newTokens);
            setUser(jwtDecode(data.access));
            localStorage.setItem('authTokens', JSON.stringify(newTokens));
            await fetchUserProfile();
        } catch (error) {
            logoutUser();
        }
    };

    useEffect(() => {
        if (!authTokens) return;
        updateToken();
        const interval = setInterval(updateToken, 1000 * 60 * 4);
        return () => clearInterval(interval);
    }, []);

    return (
        <AuthContext.Provider value={{user, userProfile, authTokens, loginUser, logoutUser}}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
