// src/pages/User/ProfilePage.jsx
import React, {useEffect, useState} from 'react';
import axios from '../../api/axiosInstance';
import {Button, Card, Col, Collapse, Form, Row, Spinner} from 'react-bootstrap';
import {toast} from 'react-toastify';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changing, setChanging] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showPwd, setShowPwd] = useState(false);

    const [user, setUser] = useState(null);
    const [form, setForm] = useState({first_name: '', last_name: '', email: ''});

    const [pwd, setPwd] = useState({old_password: '', new_password: '', confirm: ''});
    const [errors, setErrors] = useState({});
    const [pwdErrors, setPwdErrors] = useState({});

    // Load current user
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const {data} = await axios.get('users/me/');
                if (!active) return;
                setUser(data);
                setForm({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    email: data.email || '',
                });
            } catch (e) {
                toast.error('Failed to load profile');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    const onChangeField = (e) => {
        const {name, value} = e.target;
        setForm((s) => ({...s, [name]: value}));
        setErrors((s) => ({...s, [name]: ''}));
    };

    const validate = () => {
        const e = {};
        if (!form.email?.trim()) e.email = 'Email is required';
        return e;
    };

    const handleSave = async () => {
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length) return;

        setSaving(true);
        try {
            await axios.put('profile/', form);
            toast.success('Profile updated');
            setEditMode(false);
            // refresh "user" snapshot for header if needed
            setUser((u) => (u ? {...u, ...form} : u));
        } catch (err) {
            const data = err?.response?.data || {};
            setErrors({
                email: Array.isArray(data.email) ? data.email[0] : data.email,
                first_name: Array.isArray(data.first_name) ? data.first_name[0] : data.first_name,
                last_name: Array.isArray(data.last_name) ? data.last_name[0] : data.last_name,
            });
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditMode(false);
        setErrors({});
        setForm({
            first_name: user?.first_name || '',
            last_name: user?.last_name || '',
            email: user?.email || '',
        });
    };

    // Password change
    const onChangePwd = (e) => {
        const {name, value} = e.target;
        setPwd((s) => ({...s, [name]: value}));
        setPwdErrors((s) => ({...s, [name]: ''}));
    };

    const validatePwd = () => {
        const e = {};
        if (!pwd.old_password) e.old_password = 'Current password required';
        if (!pwd.new_password) e.new_password = 'New password required';
        if (pwd.new_password && pwd.new_password.length < 8) e.new_password = 'Minimum 8 characters';
        if (pwd.new_password !== pwd.confirm) e.confirm = 'Passwords do not match';
        return e;
    };

    const handleChangePassword = async () => {
        const v = validatePwd();
        setPwdErrors(v);
        if (Object.keys(v).length) return;

        setChanging(true);
        try {
            await axios.post('users/me/change-password/', {
                old_password: pwd.old_password,
                new_password: pwd.new_password,
            });
            toast.success('Password changed');
            setPwd({old_password: '', new_password: '', confirm: ''});
            setShowPwd(false);
        } catch (err) {
            const data = err?.response?.data || {};
            setPwdErrors({
                old_password: Array.isArray(data.old_password) ? data.old_password[0] : data.old_password,
                new_password: Array.isArray(data.new_password) ? data.new_password[0] : data.new_password,
            });
            toast.error('Failed to change password');
        } finally {
            setChanging(false);
        }
    };

    if (loading) {
        return (
            <div className="container py-4 text-center">
                <Spinner animation="border" role="status"/>
            </div>
        );
    }

    return (
        <div className="container py-4">
            <Card className="shadow-sm">
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">My Profile</h5>
                    {!editMode ? (
                        <Button variant="primary" onClick={() => setEditMode(true)}>
                            Edit
                        </Button>
                    ) : (
                        <div className="d-flex gap-2">
                            <Button variant="success" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                            <Button variant="outline-secondary" onClick={handleCancel} disabled={saving}>
                                Cancel
                            </Button>
                        </div>
                    )}
                </Card.Header>

                <Card.Body>
                    <Form>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Username</Form.Label>
                                    <Form.Control value={user?.username || ''} disabled/>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Email</Form.Label>
                                    <Form.Control
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={onChangeField}
                                        disabled={!editMode}
                                        isInvalid={!!errors.email}
                                    />
                                    <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>First name</Form.Label>
                                    <Form.Control
                                        name="first_name"
                                        value={form.first_name}
                                        onChange={onChangeField}
                                        disabled={!editMode}
                                        isInvalid={!!errors.first_name}
                                    />
                                    <Form.Control.Feedback type="invalid">{errors.first_name}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Last name</Form.Label>
                                    <Form.Control
                                        name="last_name"
                                        value={form.last_name}
                                        onChange={onChangeField}
                                        disabled={!editMode}
                                        isInvalid={!!errors.last_name}
                                    />
                                    <Form.Control.Feedback type="invalid">{errors.last_name}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>

                    <hr/>

                    <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">Change Password</h6>
                        <Button
                            variant={showPwd ? 'outline-secondary' : 'outline-primary'}
                            onClick={() => setShowPwd((s) => !s)}
                            aria-expanded={showPwd}
                        >
                            {showPwd ? 'Hide' : 'Show'}
                        </Button>
                    </div>

                    <Collapse in={showPwd}>
                        <div>
                            <Form className="mt-3">
                                <Row className="mb-3">
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Current password</Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="old_password"
                                                value={pwd.old_password}
                                                onChange={onChangePwd}
                                                isInvalid={!!pwdErrors.old_password}
                                                autoComplete="current-password"
                                            />
                                            <Form.Control.Feedback
                                                type="invalid">{pwdErrors.old_password}</Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>New password</Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="new_password"
                                                value={pwd.new_password}
                                                onChange={onChangePwd}
                                                isInvalid={!!pwdErrors.new_password}
                                                autoComplete="new-password"
                                            />
                                            <Form.Control.Feedback
                                                type="invalid">{pwdErrors.new_password}</Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Confirm new password</Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="confirm"
                                                value={pwd.confirm}
                                                onChange={onChangePwd}
                                                isInvalid={!!pwdErrors.confirm}
                                                autoComplete="new-password"
                                            />
                                            <Form.Control.Feedback
                                                type="invalid">{pwdErrors.confirm}</Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Button variant="warning" onClick={handleChangePassword} disabled={changing}>
                                    {changing ? 'Updating…' : 'Update Password'}
                                </Button>
                            </Form>
                        </div>
                    </Collapse>
                </Card.Body>
            </Card>
        </div>
    );
}
