// src/pages/auth/Logout.jsx
import {useContext, useEffect} from 'react';
import AuthContext from '../../context/AuthContext.jsx';

const Logout = () => {
    const {logoutUser} = useContext(AuthContext);

    useEffect(() => {
        logoutUser(); // clears tokens and redirects
    }, []);

    return null; // or show a spinner/message here
};

export default Logout;
