import React, {useContext} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';

import MainLayout from './layouts/MainLayout';
import LoginForm from './pages/Auth/LoginForm';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import Dashboard from './pages/Dashboard/Dashboard';
import Logout from './pages/Auth/Logout';
import UserList from './pages/User/UserList';
import ProfilePage from './pages/User/ProfilePage';
import CompanyList from './pages/CompanyList';
import PortList from './pages/PortList';
import ItemNameList from './pages/ItemNameList';
import ItemHeadList from './pages/ItemHeadList';
import HSCodeList from './pages/HSCodeList';
import SionNormList from './pages/Sion/SionNormList';
import BillOfEntryList from './pages/BillOfEntry/BillOfEntryList';
import LicenseList from './pages/License/LicenseList';
import IcegateCaptchaForm from './pages/IcegateCaptchaForm';
import LedgerUpload from './pages/LedgerUpload';
import AllotmentList from './pages/Allotment/AllotmentList';

import PrivateRoute from './routes/PrivateRoute';
import AuthContext from './context/AuthContext';

import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
    const {isAuthenticated} = useContext(AuthContext);

    return (
        <>
            <Routes>
                {/* Root redirect based on auth */}
                <Route
                    path="/"
                    element={
                        isAuthenticated
                            ? <Navigate to="/dashboard" replace/>
                            : <Navigate to="/login" replace/>
                    }
                />

                {/* Public auth routes */}
                <Route path="/login" element={<LoginForm/>}/>
                <Route path="/forgot-password" element={<ForgotPassword/>}/>
                <Route path="/reset/:uid/:token" element={<ResetPassword/>}/>

                {/* Protected area: single PrivateRoute wraps MainLayout + all child routes */}
                <Route
                    element={
                        <PrivateRoute>
                            <MainLayout/>
                        </PrivateRoute>
                    }
                >
                    <Route path="/logout" element={<Logout/>}/>

                    <Route path="/dashboard" element={<Dashboard/>}/>
                    <Route path="/users" element={<UserList/>}/>
                    <Route path="/profile" element={<ProfilePage/>}/>

                    <Route path="/master/company" element={<CompanyList/>}/>
                    <Route path="/master/port" element={<PortList/>}/>
                    <Route path="/master/item-heads" element={<ItemHeadList/>}/>
                    <Route path="/master/hs-codes" element={<HSCodeList/>}/>
                    <Route path="/master/item-names" element={<ItemNameList/>}/>
                    <Route path="/master/sion" element={<SionNormList/>}/>

                    <Route path="/additional/fetch-boe" element={<IcegateCaptchaForm/>}/>
                    <Route path="/additional/ledger" element={<LedgerUpload/>}/>

                    <Route path="/bill-of-entry" element={<BillOfEntryList/>}/>
                    <Route path="/licenses/dfia" element={<LicenseList/>}/>
                    <Route path="/allotment" element={<AllotmentList/>}/>
                </Route>

                {/* Catch-all */}
                <Route
                    path="*"
                    element={
                        <Navigate
                            to={isAuthenticated ? '/dashboard' : '/login'}
                            replace
                        />
                    }
                />
            </Routes>

            <ToastContainer position="top-right" autoClose={3000}/>
        </>
    );
}

export default App;
