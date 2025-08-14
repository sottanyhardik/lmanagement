import {createContext, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {toast} from 'react-toastify';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const navigate = useNavigate();

    const [authTokens, setAuthTokens] = useState(() => {
        const tokens = localStorage.getItem('authTokens');
        return tokens ? JSON.parse(tokens) : null;
    });

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = async (access, refresh) => {
        try {
            const tokens = {access, refresh};
            setAuthTokens(tokens);
            localStorage.setItem('authTokens', JSON.stringify(tokens));

            // Fetch user info immediately after login
            const response = await fetch('http://localhost:8000/api/users/me/', {
                headers: {
                    Authorization: `Bearer ${access}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                console.log(data);
                setUser(data);
                toast.success('✅ Logged in');
            } else {
                throw new Error('Failed to fetch user');
            }
        } catch (e) {
            console.error('Login error:', e);
            toast.error('❌ Login failed');
        }
    };

    const logout = () => {
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem('authTokens');
        navigate('/login');
        toast.info('👋 Logged out');
    };

    const refreshToken = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/token/refresh/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({refresh: authTokens?.refresh}),
            });

            if (response.ok) {
                const data = await response.json();
                const updatedTokens = {access: data.access, refresh: authTokens.refresh};
                setAuthTokens(updatedTokens);
                localStorage.setItem('authTokens', JSON.stringify(updatedTokens));

                // Fetch updated user info after token refresh
                const userRes = await fetch('http://localhost:8000/api/users/me/', {
                    headers: {
                        Authorization: `Bearer ${data.access}`,
                    },
                });
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setUser(userData);
                } else {
                    logout();
                }
            } else {
                logout();
            }
        } catch (err) {
            console.error('Token refresh error:', err);
            logout();
        }
    };

    useEffect(() => {
        if (authTokens && !user) {
            fetch('http://localhost:8000/api/users/me/', {
                headers: {
                    Authorization: `Bearer ${authTokens.access}`,
                },
            })
                .then((res) => res.json())
                .then((data) => {
                    console.log(data);
                    setUser(data);
                })
                .catch((err) => {
                    console.error('Failed to fetch user:', err);
                });
        }
    }, [authTokens, user]);

    useEffect(() => {
        if (authTokens) {
            const interval = setInterval(() => {
                refreshToken();
            }, 1000 * 60 * 4);

            return () => clearInterval(interval);
        }
    }, [authTokens]);

    useEffect(() => {
        setLoading(false);
    }, []);

    return (
        <AuthContext.Provider value={{user, authTokens, login, logout, setUser}}>
            {loading ? <div className="text-center mt-5">Loading...</div> : children}
        </AuthContext.Provider>
    );
};