import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './LoginPage.css';

const ResetPassword = () => {
  const { uid, token } = useParams(); // e.g. /reset/:uid/:token
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();

    if (password !== confirm) {
      toast.error('❌ Passwords do not match');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/password/reset/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, new_password: password }),
      });

      if (response.ok) {
        toast.success('✅ Password reset successful');
        navigate('/login');
      } else {
        toast.error('❌ Reset link invalid or expired');
      }
    } catch {
      toast.error('❌ Network error');
    }
  };

  return (
    <div className="login-background">
      <div className="login-card animate-fade-in">
        <div className="logo-header justify-content-center">
          <img src="/Logo.png" alt="Logo" className="logo-img" />
          <div className="logo-text text-center">License<br />Manager</div>
        </div>
        <form onSubmit={handleReset}>
          <div className="mb-3">
            <input
              type="password"
              className="form-control input-lg"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <input
              type="password"
              className="form-control input-lg"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button btn btn-lg w-100">
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
