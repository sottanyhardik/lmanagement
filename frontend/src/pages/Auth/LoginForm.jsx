// src/pages/Login/LoginForm.jsx
import React, {useContext, useMemo, useState} from 'react';
import {Button, Form, Spinner} from 'react-bootstrap';
import {Link} from 'react-router-dom';
import {toast} from 'react-toastify';
import AuthContext from '../../context/AuthContext';
import AuthShell from './components/AuthShell';
import PasswordField from './components/PasswordField';

const LoginForm = () => {
    const {loginUser} = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [capsOn, setCapsOn] = useState(false);
    const [loading, setLoading] = useState(false);

    const isFormValid = useMemo(
        () => username.trim().length >= 3 && password.trim().length >= 4,
        [username, password]
    );

    const handleKeyUp = (e) => {
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
            await loginUser({username: username.trim(), password});
        } catch (err) {
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
        <AuthShell subtitle="Sign in">
            <Form onSubmit={handleSubmit} noValidate>
                <Form.Group className="mb-3" controlId="loginUsername">
                    <Form.Label className="visually-hidden">Username</Form.Label>
                    <Form.Control
                        type="text"
                        autoComplete="username"
                        name="username"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        required
                    />
                </Form.Group>

                <div onKeyUp={handleKeyUp}>
                    <PasswordField
                        id="loginPassword"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        minLength={4}
                    />
                </div>

                {capsOn && (
                    <div className="text-warning small mb-2">Caps Lock is ON</div>
                )}

                <div className="d-flex justify-content-between align-items-center mb-3">
                    <span/>
                    <Link to="/forgot-password" className="link-primary text-decoration-none">
                        Forgot Password?
                    </Link>
                </div>

                <Button type="submit" variant="primary" className="w-100"
                        disabled={!isFormValid || loading}>
                    {loading ? (
                        <>
                            <Spinner animation="border" size="sm" className="me-2"/>
                            Signing in…
                        </>
                    ) : (
                        'Login'
                    )}
                </Button>
            </Form>
        </AuthShell>
    );
};

export default LoginForm;
