import React, {useContext} from 'react';
import {NavLink} from 'react-router-dom';
import AuthContext from '../context/AuthContext';

import {
    FaBoxes,
    FaBuilding,
    FaChartPie,
    FaCogs,
    FaDownload,
    FaFileAlt,
    FaFileUpload,
    FaKey,
    FaListAlt,
    FaSearch,
    FaSignOutAlt,
    FaUserCircle,
    FaWarehouse
} from 'react-icons/fa';

export default function Navbar() {
    const {logoutUser, user} = useContext(AuthContext);

    const displayName =
        user?.fullName ||
        user?.first_name ||
        (user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : 'Account');

    return (
        <nav className="navbar navbar-expand-lg navbar-dark navbar-custom fixed-top">
            <div className="container-fluid">
                <NavLink className="navbar-brand d-flex align-items-center" to="/dashboard">
                    <img src="/Logo.png" alt="Logo" className="dashboard-logo-img me-2"/>
                    <div className="dashboard-logo-text">
                        License<br/>Manager
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

                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        {renderNavItems()}
                    </ul>

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
                                    <NavLink className="dropdown-item" to="/profile">
                                        <FaCogs className="me-2"/>Profile
                                    </NavLink>
                                </li>

                                {user?.is_superuser && (
                                    <li>
                                        <NavLink className="dropdown-item" to="/users">
                                            <FaListAlt className="me-2"/>List Users
                                        </NavLink>
                                    </li>
                                )}

                                <li>
                                    <NavLink className="dropdown-item" to="/logout">
                                        <FaSignOutAlt className="me-2"/>Logout
                                    </NavLink>
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
// ⬇ NAVIGATION ITEMS FACTORY
// ---------------------------
function renderNavItems() {
    return (
        <>
            <DropdownMenu title="License" icon={<FaKey/>} items={[
                {label: 'DFIA', to: '/licenses/dfia', icon: <FaFileAlt/>},
                {label: 'RODTEP', to: '/licenses/rodtep', icon: <FaFileAlt/>}
            ]}/>

            <SingleLink to="/allotment" label="Allotment" icon={<FaListAlt/>}/>
            <SingleLink to="/bill-of-entry" label="Bill of Entry" icon={<FaFileAlt/>}/>

            <DropdownMenu title="Master" icon={<FaCogs/>} items={[
                {label: 'Company', to: '/master/company', icon: <FaBuilding/>},
                {label: 'Port', to: '/master/port', icon: <FaWarehouse/>},
                {label: 'HS Code', to: '/master/hs-codes', icon: <FaBuilding/>},
                {label: 'Item Head', to: '/master/item-heads', icon: <FaBuilding/>},
                {label: 'Item Name', to: '/master/item-names', icon: <FaBuilding/>},
                {label: 'Sion Norms', to: '/master/sion', icon: <FaListAlt/>}
            ]}/>

            <DropdownMenu title="Additional" icon={<FaBoxes/>} items={[
                {label: 'Upload Ledger', to: '/additional/ledger', icon: <FaFileUpload/>},
                {label: 'Fetch BOE', to: '/additional/fetch-boe', icon: <FaDownload/>}
            ]}/>

            <DropdownMenu title="Reports" icon={<FaChartPie/>} items={[
                {label: 'Item Search', to: '/reports/item-search', icon: <FaSearch/>},
                {
                    label: 'Biscuit DFIA',
                    submenu: [
                        {label: 'PARLE', to: '/reports/biscuit/parle', icon: <FaFileAlt/>},
                        {label: 'GLOBAL', to: '/reports/biscuit/global', icon: <FaFileAlt/>},
                        {label: 'CONVERSION', to: '/reports/biscuit/conversion', icon: <FaFileAlt/>}
                    ]
                }
            ]}/>
        </>
    );
}

// ---------------------------
// ⬇ COMPONENT: Single Nav Link
// ---------------------------
function SingleLink({to, label, icon}) {
    return (
        <li className="nav-item">
            <NavLink className="nav-link" to={to}>
                {icon && <span className="me-2">{icon}</span>}
                {label}
            </NavLink>
        </li>
    );
}

// ---------------------------
// ⬇ COMPONENT: Dropdown Menu
// ---------------------------
function DropdownMenu({title, icon, items}) {
    return (
        <li className="nav-item dropdown">
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
                                        <NavLink className="dropdown-item" to={subItem.to}>
                                            {subItem.icon && <span className="me-2">{subItem.icon}</span>}
                                            {subItem.label}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ) : (
                        <li key={index}>
                            <NavLink className="dropdown-item" to={item.to}>
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
