import React, {useContext} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginForm from './pages/Login/LoginForm';
import ForgotPassword from './pages/Login/ForgotPassword';
import ResetPassword from './pages/Login/ResetPassword';
import Dashboard from './pages/Dashboard/Dashboard';
import PrivateRoute from './routes/PrivateRoute';
import Logout from './pages/Login/Logout.jsx';
import EditUser from './pages/User/EditUser';
import ProfilePage from './pages/User/ProfilePage';
import CompanyList from './pages/CompanyList';
import PortList from './pages/PortList';
import ItemNameList from './pages/ItemNameList';
import ItemHeadList from './pages/ItemHeadList';
import HSCodeList from './pages/HSCodeList';
import SionNormList from './pages/Sion/SionNormList.jsx';

import IcegateCaptchaForm from './pages/IcegateCaptchaForm.jsx';
import LedgerUpload from './pages/LedgerUpload.jsx';
import AuthContext from '../src/context/AuthContext';
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


// import UserList from './components/User/UserList';

function App() {
    const {user} = useContext(AuthContext);

    return (
        <>
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
                    <Route
                        path="/profile"
                        element={
                            <PrivateRoute>
                                <ProfilePage/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/master/company"
                        element={
                            <PrivateRoute>
                                <CompanyList/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/master/port"
                        element={
                            <PrivateRoute>
                                <PortList/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/master/item-heads"
                        element={
                            <PrivateRoute>
                                <ItemHeadList/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/master/hs-codes"
                        element={
                            <PrivateRoute>
                                <HSCodeList/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/master/item-names"
                        element={
                            <PrivateRoute>
                                <ItemNameList/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/master/sion"
                        element={
                            <PrivateRoute>
                                <SionNormList/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/addtional/fetch-boe"
                        element={
                            <PrivateRoute>
                                <IcegateCaptchaForm/>
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/addtional/ledger"
                        element={
                            <PrivateRoute>
                                <LedgerUpload/>
                            </PrivateRoute>
                        }
                    />

                </Route>
            </Routes>
            <ToastContainer position="top-right" autoClose={3000}/>
        </>
    );
}

export default App;
