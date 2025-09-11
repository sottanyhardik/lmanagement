import React, {useContext, useRef} from 'react';
import {NavLink, useNavigate} from 'react-router-dom';
import AuthContext from '../context/AuthContext';

import {
    FaBoxes,
    FaBuilding,
    FaChartPie,
    FaCogs,
    FaDownload,
    FaExchangeAlt,
    FaFileAlt,
    FaFileUpload,
    FaKey,
    FaListAlt,
    FaSearch,
    FaSignOutAlt,
    FaUserCircle,
    FaWarehouse,
} from 'react-icons/fa';

export default function Navbar() {
    const {logoutUser, user} = useContext(AuthContext);
    const navigate = useNavigate();
    const collapseRef = useRef(null);

    const displayName =
        user?.fullName ||
        user?.first_name ||
        (user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : 'Account');

    const closeMobile = () => {
        // Collapse the mobile menu if it's open
        const el = collapseRef.current;
        if (!el) return;
        if (el.classList.contains('show')) {
            // Trigger bootstrap collapse via data-bs-target id
            const toggler = document.querySelector('[data-bs-target="#navbarNav"]');
            if (toggler) toggler.click();
        }
    };

    const handleLogout = (e) => {
        e.preventDefault();
        logoutUser?.();
        closeMobile();
        navigate('/login', {replace: true});
    };

    return (
        <nav className="navbar navbar-expand-lg navbar-dark navbar-custom fixed-top">
            <div className="container-fluid">
                <NavLink className="navbar-brand d-flex align-items-center" to="/dashboard" onClick={closeMobile}>
                    <img src="/static/Logo.png" alt="Logo" className="dashboard-logo-img me-2"/>
                    <div className="dashboard-logo-text">
                        License
                        <br/>
                        Manager
                    </div>
                </NavLink>

                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                    aria-controls="navbarNav"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"/>
                </button>

                <div className="collapse navbar-collapse" id="navbarNav" ref={collapseRef}>
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">{renderNavItems({closeMobile})}</ul>

                    <ul className="navbar-nav ms-auto">
                        <li className="nav-item dropdown">
                            <a
                                className="nav-link dropdown-toggle d-flex align-items-center"
                                href="#"
                                role="button"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                            >
                                <FaUserCircle className="me-2"/>
                                <span className="d-none d-lg-inline user-name">{displayName}</span>
                            </a>
                            <ul className="dropdown-menu dropdown-menu-end user-dropdown">
                                <li>
                                    <NavLink className="dropdown-item" to="/profile" onClick={closeMobile}>
                                        <FaCogs className="me-2"/>
                                        Profile
                                    </NavLink>
                                </li>

                                {user?.is_superuser && (
                                    <li>
                                        <NavLink className="dropdown-item" to="/users" onClick={closeMobile}>
                                            <FaListAlt className="me-2"/>
                                            List Users
                                        </NavLink>
                                    </li>
                                )}

                                <li>
                                    {/* Use a button-like anchor to keep dropdown styling */}
                                    <a className="dropdown-item" href="#" onClick={handleLogout}>
                                        <FaSignOutAlt className="me-2"/>
                                        Logout
                                    </a>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
}

// ---------------------------
// NAVIGATION ITEMS
// ---------------------------
function renderNavItems({closeMobile}) {
    return (
        <>
            <DropdownMenu
                title="License"
                icon={<FaKey/>}
                items={[
                    {label: 'DFIA', to: '/licenses/dfia', icon: <FaFileAlt/>},
                    // Keep RODTEP here only if the page exists
                    {label: 'RODTEP', to: '/licenses/rodtep', icon: <FaFileAlt/>},
                ]}
                onNavigate={closeMobile}
            />

            <SingleLink to="/allotment" label="Allotment" icon={<FaListAlt/>} onNavigate={closeMobile}/>
            <SingleLink to="/bill-of-entry" label="Bill of Entry" icon={<FaFileAlt/>} onNavigate={closeMobile}/>

            <DropdownMenu
                title="Master"
                icon={<FaCogs/>}
                items={[
                    {label: 'Company', to: '/master/company', icon: <FaBuilding/>},
                    {label: 'Port', to: '/master/port', icon: <FaWarehouse/>},
                    {label: 'HS Code', to: '/master/hs-codes', icon: <FaBuilding/>},
                    {label: 'Item Head', to: '/master/item-heads', icon: <FaBuilding/>},
                    {label: 'Item Name', to: '/master/item-names', icon: <FaBuilding/>},
                    {label: 'Sion Norms', to: '/master/sion', icon: <FaListAlt/>},
                ]}
                onNavigate={closeMobile}
            />

            {/* NEW: Trade menu */}
            <DropdownMenu
                title="Trade"
                icon={<FaExchangeAlt/>}
                items={[
                    {label: 'Purchase', to: '/trade/purchase', icon: <FaFileAlt/>},
                    {label: 'Sale', to: '/trade/sale', icon: <FaFileAlt/>},
                    {label: 'Payments (Paid & Received)', to: '/trade/payments', icon: <FaFileAlt/>},
                    {label: 'Commission Entry', to: '/trade/commission', icon: <FaFileAlt/>},
                    {label: 'Balance Sheet', to: '/reports/balance-sheet', icon: <FaChartPie/>},
                    {label: 'Ledger (License / Company)', to: '/reports/ledger', icon: <FaListAlt/>},
                ]}
                onNavigate={closeMobile}
            />

            <DropdownMenu
                title="Additional"
                icon={<FaBoxes/>}
                items={[
                    {label: 'Upload Ledger', to: '/additional/ledger', icon: <FaFileUpload/>},
                    {label: 'Fetch BOE', to: '/additional/fetch-boe', icon: <FaDownload/>},
                ]}
                onNavigate={closeMobile}
            />

            <DropdownMenu
                title="Reports"
                icon={<FaChartPie/>}
                items={[
                    {label: 'Item Search', to: '/reports/item-search', icon: <FaSearch/>},
                    {
                        label: 'Biscuit DFIA',
                        submenu: [
                            {label: 'PARLE', to: '/reports/biscuit/parle', icon: <FaFileAlt/>},
                            {label: 'GLOBAL', to: '/reports/biscuit/global', icon: <FaFileAlt/>},
                            {label: 'CONVERSION', to: '/reports/biscuit/conversion', icon: <FaFileAlt/>},
                        ],
                    },
                ]}
                onNavigate={closeMobile}
            />
        </>
    );
}

// ---------------------------
// COMPONENT: Single Nav Link
// ---------------------------
function SingleLink({to, label, icon, onNavigate}) {
    return (
        <li className="nav-item">
            <NavLink
                className={({isActive}) => `nav-link${isActive ? ' active' : ''}`}
                to={to}
                onClick={onNavigate}
                end
            >
                {icon && <span className="me-2">{icon}</span>}
                {label}
            </NavLink>
        </li>
    );
}

// ---------------------------
// COMPONENT: Dropdown Menu (supports nested submenu)
// ---------------------------
function DropdownMenu({title, icon, items, onNavigate}) {
    return (
        <li className="nav-item dropdown dropdown-hover">
            <a
                className="nav-link dropdown-toggle"
                href="#"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
            >
                {icon && <span className="me-2">{icon}</span>}
                {title}
            </a>

            <ul className="dropdown-menu">
                {items.map((item, index) =>
                    item.submenu ? (
                        <li className="dropdown-submenu" key={index}>
                            <a
                                className="dropdown-item dropdown-toggle"
                                href="#"
                                role="button"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                            >
                                {item.label}
                            </a>
                            <ul className="dropdown-menu">
                                {item.submenu.map((subItem, subIndex) => (
                                    <li key={subIndex}>
                                        <NavLink
                                            className={({isActive}) =>
                                                `dropdown-item${isActive ? ' active' : ''}`
                                            }
                                            to={subItem.to}
                                            onClick={onNavigate}
                                            end
                                        >
                                            {subItem.icon && <span className="me-2">{subItem.icon}</span>}
                                            {subItem.label}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ) : (
                        <li key={index}>
                            <NavLink
                                className={({isActive}) => `dropdown-item${isActive ? ' active' : ''}`}
                                to={item.to}
                                onClick={onNavigate}
                                end
                            >
                                {item.icon && <span className="me-2">{item.icon}</span>}
                                {item.label}
                            </NavLink>
                        </li>
                    )
                )}
            </ul>
        </li>
    );
}
