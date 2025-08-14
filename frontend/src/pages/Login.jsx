// src/pages/Auth.jsx
import React, {useContext, useEffect} from 'react';
import {Navigate} from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import LoginForm from './Auth/LoginForm';

const Login = () => {
    const {user} = useContext(AuthContext);

    useEffect(() => {
        document.title = 'Auth • License Manager';
    }, []);

    if (user) return <Navigate to="/dashboard" replace/>;

    return (
        <div className="login-page">
            <LoginForm/>
        </div>
    );
};

export default Login;
