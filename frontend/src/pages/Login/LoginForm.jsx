import {useContext, useState} from 'react';
import {toast} from 'react-toastify';
import AuthContext from '../../context/AuthContext.jsx';
import './LoginPage.css';

const LoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const {loginUser} = useContext(AuthContext);

    const isFormValid = username.trim().length >= 3 && password.trim().length >= 4;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!isFormValid) {
            toast.error('Please fill valid credentials');
            return;
        }
        loginUser({username, password});
    };

    return (
        <div className="login-background">
            <div className="login-card animate-fade-in">
                <div className="logo-header justify-content-center">
                    <img src="/Logo.png" alt="Logo" className="logo-img"/>
                    <div className="logo-text text-center">License<br/>Manager</div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
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
                    <button type="submit" className="btn login-button w-100" disabled={!isFormValid}>
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;
