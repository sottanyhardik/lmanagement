import {useContext, useMemo, useState} from 'react';
import {toast} from 'react-toastify';
import AuthContext from '../../context/AuthContext.jsx';
import './LoginPage.css';

const LoginForm = () => {
    const {loginUser} = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [capsOn, setCapsOn] = useState(false);

    const isFormValid = useMemo(
        () => username.trim().length >= 3 && password.trim().length >= 4,
        [username, password]
    );

    const handleKeyUp = (e) => {
        // CapsLock hint for UX on password field
        if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock'));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) {
            toast.error('Please enter a valid username and password.');
            return;
        }
        if (loading) return;

        try {
            setLoading(true);
            // Expect loginUser to throw on error or return {access, refresh, user}
            await loginUser({username: username.trim(), password});
            // If AuthContext handles navigation, nothing else needed here
        } catch (err) {
            // Show a sensible message
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.error ||
                err?.message ||
                'Login failed. Please try again.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-background">
            <div className="login-card animate-fade-in">
                <div className="logo-header justify-content-center">
                    <img src="/Logo.png" alt="Logo" className="logo-img"/>
                    <div className="logo-text text-center">
                        License<br/>Manager
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="mb-3">
                        <input
                            type="text"
                            inputMode="email"
                            autoComplete="username"
                            name="username"
                            className="form-control"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="mb-2">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            name="password"
                            className="form-control"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyUp={handleKeyUp}
                            disabled={loading}
                            required
                        />
                    </div>

                    {capsOn && !showPassword && (
                        <div className="text-warning small mb-2">Caps Lock is ON</div>
                    )}

                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="form-check m-0">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={showPassword}
                                onChange={() => setShowPassword((s) => !s)}
                                id="showPasswordCheck"
                                disabled={loading}
                            />
                            <label className="form-check-label ms-2" htmlFor="showPasswordCheck">
                                Show password
                            </label>
                        </div>
                        <a href="/forgot-password" className="forgot-link">Forgot Password?</a>
                    </div>

                    <button
                        type="submit"
                        className="btn login-button w-100"
                        disabled={!isFormValid || loading}
                    >
                        {loading ? 'Signing in…' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;
