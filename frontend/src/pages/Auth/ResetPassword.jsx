// src/pages/ResetPassword.jsx
import React, {useMemo, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {Button, Form, Spinner} from 'react-bootstrap';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';
import AuthShell from './components/AuthShell';
import PasswordField from './components/PasswordField';

const ResetPassword = () => {
    const {uid, token} = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = useMemo(
        () => password.length >= 8 && confirm.length >= 8 && password === confirm,
        [password, confirm]
    );

    const handleReset = async (e) => {
        e.preventDefault();
        if (!canSubmit) {
            toast.error('❌ Passwords must match and be at least 8 characters.');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post('password/reset/', {uid, token, new_password: password});
            toast.success('✅ Password reset successful');
            navigate('/login');
        } catch (err) {
            console.error(err);
            toast.error('❌ Reset link invalid or expired');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell subtitle="Reset Password">
            <Form onSubmit={handleReset} noValidate>
                <PasswordField
                    id="newPassword"
                    label="New password"
                    placeholder="Enter new password (min 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    minLength={8}
                    autoComplete="new-password"
                />

                <PasswordField
                    id="confirmPassword"
                    label="Confirm password"
                    placeholder="Re-enter new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={submitting}
                    minLength={8}
                    autoComplete="new-password"
                    isInvalid={confirm !== '' && confirm !== password}
                    feedback={confirm !== '' && confirm !== password ? 'Passwords do not match' : undefined}
                />

                <div className="d-flex justify-content-between align-items-center">
                    <Link to="/login" className="text-decoration-none">
                        ← Back to Login
                    </Link>
                    <Button type="submit" disabled={!canSubmit || submitting}>
                        {submitting ? (
                            <>
                                <Spinner size="sm" animation="border" className="me-2"/> Resetting…
                            </>
                        ) : (
                            'Reset Password'
                        )}
                    </Button>
                </div>
            </Form>
        </AuthShell>
    );
};

export default ResetPassword;
