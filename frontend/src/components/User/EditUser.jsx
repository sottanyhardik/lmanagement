import {useContext, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import {toast} from 'react-toastify';

const ProfileViewEdit = () => {
    const {user, authTokens} = useContext(AuthContext);
    const id = user?.user_id;
    const navigate = useNavigate();

    const [form, setForm] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        is_superuser: false,
    });

    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        if (id) {
            fetch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}/`, {
                headers: {
                    Authorization: `Bearer ${authTokens?.access}`,
                },
            })
                .then((res) => res.json())
                .then((data) => {
                    setForm({
                        username: data.username,
                        email: data.email || '',
                        first_name: data.first_name || '',
                        last_name: data.last_name || '',
                        is_superuser: data.is_superuser,
                    });
                });
        }
    }, [id, authTokens]);

    const handleChange = (e) => {
        const {name, value, type, checked} = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authTokens.access}`,
            },
            body: JSON.stringify(form),
        });

        if (res.ok) {
            toast.success('Profile updated');
            setEditMode(false);
        } else {
            toast.error('Update failed');
        }
    };

    return (
        <div className="container py-4">
            <div className="card p-4">
                <h3 className="mb-4">My Profile</h3>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input
                            name="username"
                            className="form-control"
                            value={form.username}
                            disabled
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input
                            name="email"
                            className="form-control"
                            value={form.email}
                            disabled={!editMode}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">First Name</label>
                        <input
                            name="first_name"
                            className="form-control"
                            value={form.first_name}
                            disabled={!editMode}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Last Name</label>
                        <input
                            name="last_name"
                            className="form-control"
                            value={form.last_name}
                            disabled={!editMode}
                            onChange={handleChange}
                        />
                    </div>

                    {editMode ? (
                        <div className="d-flex gap-2">
                            <button type="submit" className="btn btn-success">Save</button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setEditMode(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{backgroundColor: '#e16123', border: 'none'}}
                            onClick={() => setEditMode(true)}
                        >
                            Edit Profile
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ProfileViewEdit;
