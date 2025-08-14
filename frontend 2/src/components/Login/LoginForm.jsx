import {useContext, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {toast} from 'react-toastify';
import {AuthContext} from '../../context/AuthContext';
import './LoginPage.css';

const LoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const {login} = useContext(AuthContext);
    const navigate = useNavigate();

    const isUsernameValid = username.trim().length >= 3;
    const isPasswordValid = password.trim().length >= 4;
    const isFormValid = isUsernameValid && isPasswordValid;

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch('http://localhost:8000/api/token/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password}),
            });

            if (!response.ok) {
                toast.error('❌ Invalid username or password');
                return;
            }

            const data = await response.json();
            if (data.access && data.refresh) {
                login(data.access, data.refresh);
                navigate('/dashboard');
            } else {
                toast.error('Login failed');
            }
        } catch {
            toast.error('❌ Network error');
        }
    };

    return (
        <div className="login-background">
            <div className="login-card animate-fade-in">
                <div className="logo-header justify-content-center">
                    <img src="/Logo.png" alt="Logo" className="logo-img"/>
                    <div className="logo-text text-center">License<br/>Manager</div>
                </div>
                <form onSubmit={handleLogin}>
                    <div className="mb-3">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        {!isUsernameValid && username && (
                            <small className="text-danger">Min 3 characters</small>
                        )}
                    </div>
                    <div className="mb-3">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-control"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {!isPasswordValid && password && (
                            <small className="text-danger">Min 4 characters</small>
                        )}
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="form-check m-0">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={showPassword}
                                onChange={() => setShowPassword(!showPassword)}
                                id="showPasswordCheck"
                            />
                            <label className="form-check-label ms-2" htmlFor="showPasswordCheck">
                                Show Password
                            </label>
                        </div>
                        <a href="/forgot-password" className="forgot-link">Forgot Password?</a>
                    </div>

                    <button
                        type="submit"
                        className="btn login-button w-100"
                        disabled={!isFormValid}
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;
