// src/pages/UserList.jsx
import React, {useEffect, useMemo, useState} from 'react';
import axios from '../../api/axiosInstance';
import {Badge, Button, Card, Form, InputGroup, Spinner, Table} from 'react-bootstrap';
import {toast} from 'react-toastify';

// 👉 adjust this if your accounts API is namespaced (e.g. 'accounts/')
const ACC_PREFIX = ''; // e.g. 'accounts/'

// simple client-side password generator (for /register/)
const randomPassword = (len = 12) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
};

// Normalize any users payload into an array
const normalizeUsers = (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
};

export default function UserList() {
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [sendingFor, setSendingFor] = useState(null);
    const [creating, setCreating] = useState(false);

    const [users, setUsers] = useState([]); // always an array after normalize
    const [search, setSearch] = useState('');
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({});
    const [createRow, setCreateRow] = useState({username: '', email: '', first_name: '', last_name: ''});
    const [errors, setErrors] = useState({});
    const [createErrors, setCreateErrors] = useState({});

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const {data} = await axios.get(`${ACC_PREFIX}users/`);
            setUsers(normalizeUsers(data));
        } catch (e) {
            setUsers([]); // keep render safe
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filtered = useMemo(() => {
        const list = Array.isArray(users) ? users : [];
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter((u) =>
            (u?.username || '').toLowerCase().includes(q) ||
            (u?.email || '').toLowerCase().includes(q) ||
            (u?.first_name || '').toLowerCase().includes(q) ||
            (u?.last_name || '').toLowerCase().includes(q)
        );
    }, [search, users]);

    // inline edit
    const startEdit = (u) => {
        setEditId(u.id);
        setErrors({});
        setForm({
            id: u.id,
            email: u.email || '',
            first_name: u.first_name || '',
            last_name: u.last_name || '',
            is_active: u.is_active ?? true,
        });
    };
    const cancelEdit = () => {
        setEditId(null);
        setForm({});
        setErrors({});
    };
    const changeEditField = (name, value) => {
        setForm((s) => ({...s, [name]: value}));
        setErrors((s) => ({...s, [name]: ''}));
    };
    const saveEdit = async () => {
        if (!form?.id) return;
        setSavingId(form.id);
        try {
            const {data} = await axios.put(`${ACC_PREFIX}users/${form.id}/`, {
                email: form.email,
                first_name: form.first_name,
                last_name: form.last_name,
                is_active: form.is_active,
            });
            toast.success('User updated');
            setUsers((prev) => prev.map((u) => (u.id === form.id ? {...u, ...data} : u)));
            cancelEdit();
        } catch (err) {
            const payload = err?.response?.data || {};
            setErrors({
                email: Array.isArray(payload.email) ? payload.email[0] : payload.email,
                first_name: Array.isArray(payload.first_name) ? payload.first_name[0] : payload.first_name,
                last_name: Array.isArray(payload.last_name) ? payload.last_name[0] : payload.last_name,
                is_active: Array.isArray(payload.is_active) ? payload.is_active[0] : payload.is_active,
            });
            toast.error('Failed to update user');
        } finally {
            setSavingId(null);
        }
    };

    // inline create
    const changeCreateField = (name, value) => {
        setCreateRow((s) => ({...s, [name]: value}));
        setCreateErrors((s) => ({...s, [name]: ''}));
    };
    const createUser = async () => {
        const e = {};
        if (!createRow.username?.trim()) e.username = 'Username is required';
        if (!createRow.email?.trim()) e.email = 'Email is required';
        if (Object.keys(e).length) {
            setCreateErrors(e);
            return;
        }
        setCreating(true);
        try {
            const tempPwd = randomPassword();
            await axios.post(`${ACC_PREFIX}register/`, {
                username: createRow.username.trim(),
                email: createRow.email.trim(),
                password: tempPwd,
                first_name: (createRow.first_name || '').trim(),
                last_name: (createRow.last_name || '').trim(),
            });
            toast.success('User created');
            setCreateRow({username: '', email: '', first_name: '', last_name: ''});
            setCreateErrors({});
            fetchUsers();
        } catch (err) {
            const payload = err?.response?.data || {};
            setCreateErrors({
                username: Array.isArray(payload.username) ? payload.username[0] : payload.username,
                email: Array.isArray(payload.email) ? payload.email[0] : payload.email,
                password: Array.isArray(payload.password) ? payload.password[0] : payload.password,
            });
            toast.error('Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    // password reset link
    const sendResetLink = async (email) => {
        if (!email) {
            toast.error('User has no email');
            return;
        }
        setSendingFor(email);
        try {
            await axios.post(`${ACC_PREFIX}password/forgot/`, {email});
            toast.success('Reset link emailed (if account exists)');
        } catch {
            toast.error('Failed to send reset link');
        } finally {
            setSendingFor(null);
        }
    };

    return (
        <div className="container py-4">
            <Card className="shadow-sm">
                <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <h5 className="mb-0">User List</h5>
                    <InputGroup style={{maxWidth: 320}}>
                        <InputGroup.Text>Search</InputGroup.Text>
                        <Form.Control
                            placeholder="username, email, name…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </InputGroup>
                </Card.Header>

                <Card.Body className="pt-0">
                    {/* Inline create row */}
                    <div className="border rounded p-3 my-3 bg-light">
                        <div className="fw-semibold mb-2">Add User</div>
                        <div className="row g-2">
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Username</Form.Label>
                                    <Form.Control
                                        value={createRow.username}
                                        onChange={(e) => changeCreateField('username', e.target.value)}
                                        isInvalid={!!createErrors.username}
                                    />
                                    <Form.Control.Feedback
                                        type="invalid">{createErrors.username}</Form.Control.Feedback>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Email</Form.Label>
                                    <Form.Control
                                        type="email"
                                        value={createRow.email}
                                        onChange={(e) => changeCreateField('email', e.target.value)}
                                        isInvalid={!!createErrors.email}
                                    />
                                    <Form.Control.Feedback type="invalid">{createErrors.email}</Form.Control.Feedback>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>First name</Form.Label>
                                    <Form.Control
                                        value={createRow.first_name}
                                        onChange={(e) => changeCreateField('first_name', e.target.value)}
                                        isInvalid={!!createErrors.first_name}
                                    />
                                    <Form.Control.Feedback
                                        type="invalid">{createErrors.first_name}</Form.Control.Feedback>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Last name</Form.Label>
                                    <Form.Control
                                        value={createRow.last_name}
                                        onChange={(e) => changeCreateField('last_name', e.target.value)}
                                        isInvalid={!!createErrors.last_name}
                                    />
                                    <Form.Control.Feedback
                                        type="invalid">{createErrors.last_name}</Form.Control.Feedback>
                                </Form.Group>
                            </div>
                        </div>

                        <div className="mt-3 d-flex gap-2">
                            <Button onClick={createUser} disabled={creating}>
                                {creating ? 'Creating…' : 'Add User'}
                            </Button>
                            {createRow.email && (
                                <Button
                                    variant="outline-secondary"
                                    onClick={() => sendResetLink(createRow.email)}
                                    disabled={creating || sendingFor === createRow.email}
                                    title="Send a password reset link to this email"
                                >
                                    {sendingFor === createRow.email ? 'Sending…' : 'Send Reset Link'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Users table */}
                    {loading ? (
                        <div className="py-4 text-center">
                            <Spinner animation="border" role="status"/>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="align-middle">
                                <thead className="table-light">
                                <tr className="text-nowrap">
                                    <th style={{width: 70}}>ID</th>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>First</th>
                                    <th>Last</th>
                                    <th style={{width: 110}}>Active</th>
                                    <th style={{width: 240}} className="text-center">Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {Array.isArray(filtered) && filtered.length > 0 ? (
                                    filtered.map((u) => {
                                        const editing = editId === u.id;
                                        return (
                                            <tr key={u.id ?? u.username}>
                                                <td>
                                                    <Badge
                                                        bg={u.is_superuser ? 'danger' : u.is_staff ? 'warning' : 'secondary'}>
                                                        {u.id ?? '—'}
                                                    </Badge>
                                                </td>
                                                <td>{u.username ?? '—'}</td>

                                                <td>
                                                    {editing ? (
                                                        <Form.Control
                                                            type="email"
                                                            value={form.email}
                                                            onChange={(e) => changeEditField('email', e.target.value)}
                                                            isInvalid={!!errors.email}
                                                            size="sm"
                                                        />
                                                    ) : (
                                                        u.email || '—'
                                                    )}
                                                    {editing && errors.email && (
                                                        <div className="invalid-feedback d-block">{errors.email}</div>
                                                    )}
                                                </td>

                                                <td style={{minWidth: 140}}>
                                                    {editing ? (
                                                        <Form.Control
                                                            value={form.first_name}
                                                            onChange={(e) => changeEditField('first_name', e.target.value)}
                                                            isInvalid={!!errors.first_name}
                                                            size="sm"
                                                        />
                                                    ) : (
                                                        u.first_name || '—'
                                                    )}
                                                    {editing && errors.first_name && (
                                                        <div
                                                            className="invalid-feedback d-block">{errors.first_name}</div>
                                                    )}
                                                </td>

                                                <td style={{minWidth: 140}}>
                                                    {editing ? (
                                                        <Form.Control
                                                            value={form.last_name}
                                                            onChange={(e) => changeEditField('last_name', e.target.value)}
                                                            isInvalid={!!errors.last_name}
                                                            size="sm"
                                                        />
                                                    ) : (
                                                        u.last_name || '—'
                                                    )}
                                                    {editing && errors.last_name && (
                                                        <div
                                                            className="invalid-feedback d-block">{errors.last_name}</div>
                                                    )}
                                                </td>

                                                <td className="text-center">
                                                    {editing ? (
                                                        <Form.Check
                                                            type="switch"
                                                            checked={!!form.is_active}
                                                            onChange={(e) => changeEditField('is_active', e.target.checked)}
                                                            label=""
                                                        />
                                                    ) : u.is_active ? (
                                                        <span className="text-success">Yes</span>
                                                    ) : (
                                                        <span className="text-danger">No</span>
                                                    )}
                                                </td>

                                                <td className="text-center">
                                                    {!editing ? (
                                                        <div className="d-inline-flex gap-2">
                                                            <Button size="sm" variant="outline-primary"
                                                                    onClick={() => startEdit(u)}>
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline-secondary"
                                                                onClick={() => sendResetLink(u.email)}
                                                                disabled={sendingFor === u.email}
                                                                title="Email a reset link"
                                                            >
                                                                {sendingFor === u.email ? 'Sending…' : 'Send Reset Link'}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="d-inline-flex gap-2">
                                                            <Button size="sm" variant="success" onClick={saveEdit}
                                                                    disabled={savingId === u.id}>
                                                                {savingId === u.id ? 'Saving…' : 'Save'}
                                                            </Button>
                                                            <Button size="sm" variant="outline-secondary"
                                                                    onClick={cancelEdit} disabled={savingId === u.id}>
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center text-muted py-4">No users found.</td>
                                    </tr>
                                )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
}
