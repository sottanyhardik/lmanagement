import {useContext, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import {toast} from 'react-toastify';

const AddUser = () => {
    const {authTokens} = useContext(AuthContext);
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: '', email: '', first_name: '', last_name: '', password: '', is_superuser: false,
    });

    const handleChange = e => {
        const {name, value, type, checked} = e.target;
        setForm(prev => ({...prev, [name]: type === 'checkbox' ? checked : value}));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('${import.meta.env.VITE_API_BASE_URL}/users/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authTokens.access}`,
            },
            body: JSON.stringify(form),
        });

        if (res.ok) {
            toast.success('User created');
            navigate('/users');
        } else {
            toast.error('Failed to create user');
        }
    };

    return (
        <div className="container py-5">
            <h3>Add New User</h3>
            <form onSubmit={handleSubmit}>
                <input name="username" className="form-control mb-3" placeholder="Username" value={form.username}
                       onChange={handleChange} required/>
                <input name="email" className="form-control mb-3" placeholder="Email" value={form.email}
                       onChange={handleChange}/>
                <input name="first_name" className="form-control mb-3" placeholder="First Name" value={form.first_name}
                       onChange={handleChange}/>
                <input name="last_name" className="form-control mb-3" placeholder="Last Name" value={form.last_name}
                       onChange={handleChange}/>
                <input name="password" type="password" className="form-control mb-3" placeholder="Password"
                       value={form.password} onChange={handleChange} required/>
                <div className="form-check mb-3">
                    <input type="checkbox" name="is_superuser" className="form-check-input" checked={form.is_superuser}
                           onChange={handleChange}/>
                    <label className="form-check-label">Superuser</label>
                </div>
                <button className="btn btn-primary">Create User</button>
            </form>
        </div>
    );
};

export default AddUser;
