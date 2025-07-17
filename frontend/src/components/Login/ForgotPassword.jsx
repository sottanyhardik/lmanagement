import {useState} from 'react';
import {toast} from 'react-toastify';
import './LoginPage.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('${import.meta.env.VITE_API_BASE_URL}/password/forgot/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email}),
            });

            if (response.ok) {
                toast.success('📩 Password reset email sent');
            } else {
                toast.error('❌ Failed to send reset email');
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
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <input
                            type="email"
                            className="form-control"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="d-flex justify-content-end mb-3">
                        <a href="/login" className="forgot-link">🔙 Back to Login</a>
                    </div>
                    <button type="submit" className="btn login-button w-100">
                        Send Reset Link
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
