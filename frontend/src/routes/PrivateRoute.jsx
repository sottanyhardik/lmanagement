// routes/PrivateRoute.jsx
import {useContext} from 'react';
import {Navigate, useLocation} from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const PrivateRoute = ({children}) => {
    const {isAuthenticated} = useContext(AuthContext);
    const location = useLocation();

    return isAuthenticated
        ? children
        : <Navigate to="/login" replace state={{from: location}}/>;
};

export default PrivateRoute;
