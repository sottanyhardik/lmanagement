// src/pages/ForgotPassword.jsx
import React, {useState} from 'react';
import {Button, Form, Spinner} from 'react-bootstrap';
import {Link} from 'react-router-dom';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';
import AuthShell from './components/AuthShell';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) return;

        setSubmitting(true);
        try {
            await axios.post('password/forgot/', {email: trimmed});
            toast.success('📩 If the email exists, a reset link has been sent.');
            setEmail('');
        } catch (err) {
            console.error(err);
            toast.error('❌ Failed to send reset email');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell subtitle="Forgot Password">
            <Form onSubmit={handleSubmit} noValidate>
                <Form.Group className="mb-3" controlId="fpEmail">
                    <Form.Label>Email address</Form.Label>
                    <Form.Control
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        disabled={submitting}
                    />
                </Form.Group>

                <div className="d-flex justify-content-between align-items-center">
                    <Link to="/login" className="text-decoration-none">
                        ← Back to Login
                    </Link>
                    <Button type="submit" disabled={submitting}>
                        {submitting ? (
                            <>
                                <Spinner size="sm" animation="border" className="me-2"/> Sending…
                            </>
                        ) : (
                            'Send Reset Link'
                        )}
                    </Button>
                </div>
            </Form>
        </AuthShell>
    );
};

export default ForgotPassword;
