import React, {useContext} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginForm from './components/Login/LoginForm';
import ForgotPassword from './components/Login/ForgotPassword';
import ResetPassword from './components/Login/ResetPassword';
import Dashboard from './components/Dashboard/Dashboard';
import PrivateRoute from './routes/PrivateRoute';
import Logout from './components/Login/Logout.jsx';
import EditUser from './components/User/EditUser';
import AuthContext from '../src/context/AuthContext';

// import UserList from './components/User/UserList';

function App() {
    const {user} = useContext(AuthContext);

    return (
        <Routes>
            <Route path="/" element={
                user ? <Navigate to="/dashboard" replace/> : <Navigate to="/login" replace/>
            }/>
            <Route path="/login" element={<LoginForm/>}/>
            <Route path="/forgot-password" element={<ForgotPassword/>}/>
            <Route path="/reset/:uid/:token" element={<ResetPassword/>}/>

            <Route element={<MainLayout/>}>
                <Route path="/logout" element={<Logout/>}/>
                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <Dashboard/>
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/profile/edit"
                    element={
                        <PrivateRoute>
                            <EditUser/>
                        </PrivateRoute>
                    }
                />
                {/*<Route*/}
                {/*    path="/users"*/}
                {/*    element={*/}
                {/*        <PrivateRoute>*/}
                {/*            <UserList/>*/}
                {/*        </PrivateRoute>*/}
                {/*    }*/}
                {/*/>*/}
            </Route>
        </Routes>
    );
}

export default App;
