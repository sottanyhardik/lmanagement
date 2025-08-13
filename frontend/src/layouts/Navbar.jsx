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
import './Navbar.css';

export default function Navbar() {
    const {logoutUser: logout, user} = useContext(AuthContext);

    const displayName =
        user?.fullName ||
        user?.first_name ||
        (user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : 'Account');

    return (
        <nav className="navbar navbar-expand-lg navbar-dark navbar-custom fixed-top">
            <div className="container-fluid">
                <NavLink className="navbar-brand d-flex align-items-center" to="/dashboard">
                    <img src="/Logo.png" alt="Logo" className="dashboard-logo-img me-2"/>
                    <div className="dashboard-logo-text">License<br/>Manager</div>
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
                    {/* LEFT NAV */}
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">

                        {/* License */}
                        <li className="nav-item dropdown">
                            <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown"
                               aria-expanded="false">
                                <FaKey className="me-2"/> License
                            </a>
                            <ul className="dropdown-menu">
                                <li>
                                    <NavLink className="dropdown-item" to="/licenses/dfia">
                                        <FaFileAlt className="me-2"/> DFIA
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink className="dropdown-item" to="/licenses/rodtep">
                                        <FaFileAlt className="me-2"/> RODTEP
                                    </NavLink>
                                </li>
                            </ul>
                        </li>

                        <li className="nav-item">
                            <NavLink className="nav-link" to="/allotment">
                                <FaListAlt className="me-2"/> Allotment
                            </NavLink>
                        </li>

                        <li className="nav-item">
                            <NavLink className="nav-link" to="/bill-of-entry">
                                <FaFileAlt className="me-2"/> Bill of Entry
                            </NavLink>
                        </li>

                        {/* Master */}
                        <li className="nav-item dropdown">
                            <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown"
                               aria-expanded="false">
                                <FaCogs className="me-2"/> Master
                            </a>
                            <ul className="dropdown-menu">
                                <li>
                                    <NavLink className="dropdown-item" to="/master/company">
                                        <FaBuilding className="me-2"/> Company
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink className="dropdown-item" to="/master/port">
                                        <FaWarehouse className="me-2"/> Port
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink className="dropdown-item" to="/master/hs-codes">
                                        <FaBuilding className="me-2"/> HS Code
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink className="dropdown-item" to="/master/item-heads">
                                        <FaBuilding className="me-2"/> Item Head
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink className="dropdown-item" to="/master/item-names">
                                        <FaBuilding className="me-2"/> Item Name
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink className="dropdown-item" to="/master/sion">
                                        <FaListAlt className="me-2"/> Sion Norms
                                    </NavLink>
                                </li>
                            </ul>
                        </li>

                        {/* Additional */}
                        <li className="nav-item dropdown">
                            <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown"
                               aria-expanded="false">
                                <FaBoxes className="me-2"/> Additional
                            </a>
                            <ul className="dropdown-menu">
                                <li>
                                    <NavLink className="dropdown-item" to="/additional/ledger">
                                        <FaFileUpload className="me-2"/> Upload Ledger
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink className="dropdown-item" to="/additional/fetch-boe">
                                        <FaDownload className="me-2"/> Fetch BOE
                                    </NavLink>
                                </li>
                            </ul>
                        </li>

                        {/* Reports (with nested submenu) */}
                        <li className="nav-item dropdown">
                            <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown"
                               aria-expanded="false">
                                <FaChartPie className="me-2"/> Reports
                            </a>
                            <ul className="dropdown-menu" data-bs-auto-close="outside">
                                <li>
                                    <NavLink className="dropdown-item" to="/reports/item-search">
                                        <FaSearch className="me-2"/> Item Search
                                    </NavLink>
                                </li>

                                {/* Submenu */}
                                <li className="dropdown-submenu">
                                    <a className="dropdown-item dropdown-toggle" href="#" data-bs-toggle="dropdown"
                                       aria-expanded="false">
                                        Biscuit DFIA
                                    </a>
                                    <ul className="dropdown-menu">
                                        <li>
                                            <NavLink className="dropdown-item" to="/reports/biscuit/parle">
                                                <FaFileAlt className="me-2"/> PARLE
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink className="dropdown-item" to="/reports/biscuit/global">
                                                <FaFileAlt className="me-2"/> GLOBAL
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink className="dropdown-item" to="/reports/biscuit/conversion">
                                                <FaFileAlt className="me-2"/> CONVERSION
                                            </NavLink>
                                        </li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                    </ul>

                    {/* RIGHT (Account) */}
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
                                            <FaListAlt className="me-2"/> List Users
                                        </NavLink>
                                    </li>
                                )}

                                <li>
                                    <NavLink className="dropdown-item" to="/logout">
                                        <FaSignOutAlt className="me-2"/> Logout
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
