import React, {lazy, Suspense, useContext} from 'react';
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

import SessionExpiryTimer from './components/SessionExpiryTimer';
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// 🔁 Lazy-load the shared Trade list UI
const TradeList = lazy(() => import('./pages/Trade/TradeList'));

// Optional: lazy reports (keep your existing files if you already have them)
const BalanceSheetPage = lazy(() => import('./pages/Reports/BalanceSheetPage'));
const LedgerPage = lazy(() => import('./pages/Reports/LedgerPage'));

// Simple inline wrappers that pre-set the direction filter after mount
function AllPurchasesWrapper() {
    return (
        <Suspense fallback={<div className="p-3 text-muted">Loading…</div>}>
            <TradeListInitializer direction="PURCHASE"/>
        </Suspense>
    );
}

function AllSalesWrapper() {
    return (
        <Suspense fallback={<div className="p-3 text-muted">Loading…</div>}>
            <TradeListInitializer direction="SALE"/>
        </Suspense>
    );
}

/**
 * TradeListInitializer
 * Mounts TradeList and nudges its filters to a default direction once.
 * This avoids changing your hooks and keeps the route-specific default.
 */
function TradeListInitializer({direction}) {
    // We set the default direction by poking TradeList via a render-prop pattern:
    // TradeList accepts an optional `onReady` callback that exposes its `{ setFilters }`.
    // If your current TradeList doesn't have this prop, you can add:
    //   useEffect(() => onReady?.({ setFilters }), [onReady, setFilters]);
    // For now, we fall back to a small shim component that expects TradeList to accept `initialFilters`.
    const Initializer = (props) => {
        // If your TradeList supports `initialFilters`, this will work out of the box:
        return <TradeList initialFilters={{direction}} {...props} />;
    };
    return <Initializer/>;
}

// (Optional) Very light placeholders for these pages if you don’t have them yet.
// You can swap to your real components at any time.
function PaymentsPage() {
    return <div className="container py-3">💳 Payments — coming soon</div>;
}

function CommissionPage() {
    return <div className="container py-3">🧾 Commission — coming soon</div>;
}

function App() {
    const {isAuthenticated} = useContext(AuthContext);

    return (
        <>
            <Routes>
                {/* Root redirect based on auth */}
                <Route
                    path="/"
                    element={
                        isAuthenticated ? <Navigate to="/dashboard" replace/> : <Navigate to="/login" replace/>
                    }
                />

                {/* Public auth routes */}
                <Route path="/login" element={<LoginForm/>}/>
                <Route path="/forgot-password" element={<ForgotPassword/>}/>
                <Route path="/reset/:uid/:token" element={<ResetPassword/>}/>

                {/* Protected area */}
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

                    {/* Master */}
                    <Route path="/master/company" element={<CompanyList/>}/>
                    <Route path="/master/port" element={<PortList/>}/>
                    <Route path="/master/item-heads" element={<ItemHeadList/>}/>
                    <Route path="/master/hs-codes" element={<HSCodeList/>}/>
                    <Route path="/master/item-names" element={<ItemNameList/>}/>
                    <Route path="/master/sion" element={<SionNormList/>}/>

                    {/* Additional */}
                    <Route path="/additional/fetch-boe" element={<IcegateCaptchaForm/>}/>
                    <Route path="/additional/ledger" element={<LedgerUpload/>}/>

                    {/* Core */}
                    <Route path="/bill-of-entry" element={<BillOfEntryList/>}/>
                    <Route path="/licenses/dfia" element={<LicenseList/>}/>
                    <Route path="/allotment" element={<AllotmentList/>}/>

                    {/* Trade menu routes */}
                    <Route path="/trade/purchase" element={<AllPurchasesWrapper/>}/>
                    <Route path="/trade/sale" element={<AllSalesWrapper/>}/>
                    <Route path="/trade/payments" element={<PaymentsPage/>}/>
                    <Route path="/trade/commission" element={<CommissionPage/>}/>

                    {/* Reports from Trade dropdown */}
                    <Route
                        path="/reports/balance-sheet"
                        element={
                            <Suspense fallback={<div className="p-3 text-muted">Loading…</div>}>
                                <BalanceSheetPage/>
                            </Suspense>
                        }
                    />
                    <Route
                        path="/reports/ledger"
                        element={
                            <Suspense fallback={<div className="p-3 text-muted">Loading…</div>}>
                                <LedgerPage/>
                            </Suspense>
                        }
                    />
                </Route>

                {/* Catch-all */}
                <Route
                    path="*"
                    element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace/>}
                />
            </Routes>

            {/* Small top-right pill that counts down to earliest expiry (token/idle) */}
            <SessionExpiryTimer/>

            {/* Nudge the toasts down slightly so they don't overlap the timer */}
            <ToastContainer position="top-right" autoClose={3000} style={{marginTop: 40}}/>
        </>
    );
}

export default App;
