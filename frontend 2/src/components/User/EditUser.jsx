import {useContext, useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {AuthContext} from '../../context/AuthContext';
import {toast} from 'react-toastify';

const EditUser = () => {
    const {id} = useParams();
    const {authTokens} = useContext(AuthContext);
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        is_superuser: false,
    });

    useEffect(() => {
        if (id) {
            fetch(`http://localhost:8000/api/users/1/`, {
                headers: {
                    Authorization: `Bearer ${authTokens?.access}`,
                },
            })
                .then(res => res.json())
                .then(data => {
                    console.log(data);
                    setForm({
                        username: data.username,
                        email: data.email,
                        first_name: data.first_name || '',
                        last_name: data.last_name || '',
                        is_superuser: data.is_superuser,
                    });
                });
        }
    }, [id, authTokens]);

    const handleChange = e => {
        const {name, value, type, checked} = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async e => {
        e.preventDefault();
        const res = await fetch(`http://localhost:8000/api/users/${id}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authTokens.access}`,
            },
            body: JSON.stringify(form),
        });

        if (res.ok) {
            toast.success('User updated');
            navigate('/users');
        } else {
            toast.error('Update failed');
        }
    };

    return (
        <div className="container py-4">
            <div className="card p-4">
                <h3 className="mb-4">Edit User</h3>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input name="username" className="form-control" value={form.username} disabled/>
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input name="email" className="form-control" value={form.email} onChange={handleChange}/>
                    </div>
                    <div className="mb-3">
                        <label className="form-label">First Name</label>
                        <input name="first_name" className="form-control" value={form.first_name}
                               onChange={handleChange}/>
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Last Name</label>
                        <input name="last_name" className="form-control" value={form.last_name}
                               onChange={handleChange}/>
                    </div>
                    <div className="form-check mb-3">
                        <input
                            type="checkbox"
                            name="is_superuser"
                            className="form-check-input"
                            checked={form.is_superuser}
                            onChange={handleChange}
                        />
                        <label className="form-check-label">Superuser</label>
                    </div>
                    <button className="btn btn-primary" style={{backgroundColor: '#e16123', border: 'none'}}>
                        Update
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditUser;
