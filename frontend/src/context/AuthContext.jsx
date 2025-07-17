// AuthContext.jsx with full user profile support
import React, {createContext, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import {toast} from 'react-toastify';

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

    const fetchUserProfile = async (accessToken) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/me/`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const profile = await response.json();
                setUserProfile(profile);
            } else {
                console.error('Failed to fetch user profile');
            }
        } catch (error) {
            console.error('Profile fetch error:', error);
        }
    };

    const loginUser = async ({username, password}) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/token/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password}),
            });

            const data = await response.json();

            if (response.ok) {
                setAuthTokens(data);
                setUser(jwtDecode(data.access));
                localStorage.setItem('authTokens', JSON.stringify(data));

                await fetchUserProfile(data.access);
                navigate('/dashboard');
            } else {
                toast.error('❌ Invalid username or password');
            }
        } catch (error) {
            toast.error('❌ Network error during login');
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
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/token/refresh/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({refresh: authTokens.refresh}),
            });

            if (response.ok) {
                const data = await response.json();
                const newTokens = {...authTokens, access: data.access};
                setAuthTokens(newTokens);
                setUser(jwtDecode(data.access));
                localStorage.setItem('authTokens', JSON.stringify(newTokens));
                await fetchUserProfile(data.access);
            } else {
                logoutUser();
            }
        } catch {
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