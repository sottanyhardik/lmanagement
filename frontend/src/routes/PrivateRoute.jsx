import {useContext} from 'react';
import {Navigate} from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const PrivateRoute = ({children}) => {
    const {user} = useContext(AuthContext);
    console.log(user);
    if (!user.username) return <Navigate to="/login" replace/>;

    return user ? children : <Navigate to="/login"/>;
};

export default PrivateRoute;
