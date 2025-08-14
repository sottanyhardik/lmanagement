// src/pages/auth/Logout.jsx
import {useContext, useEffect} from 'react';
import {AuthContext} from '../../context/AuthContext';

const Logout = () => {
    const {logout} = useContext(AuthContext);

    useEffect(() => {
        logout(); // clears tokens and redirects
    }, []);

    return null; // or return a loader/spinner
};

export default Logout;
