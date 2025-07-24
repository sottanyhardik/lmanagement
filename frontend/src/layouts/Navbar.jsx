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
    FaWarehouse,
} from 'react-icons/fa';
import './Navbar.css';

const Navbar = () => {
    const {logout, user} = useContext(AuthContext);

    return (
        <nav className="navbar navbar-expand-lg navbar-dark navbar-custom">
            <div className="container-fluid">
                <NavLink className="navbar-brand d-flex align-items-center" to="/dashboard">
                    <img src="/Logo.png" alt="Logo" className="dashboard-logo-img me-2"/>
                    <div className="dashboard-logo-text">License<br/>Manager</div>
                </NavLink>

                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">

                        <li className="nav-item dropdown">
              <span className="nav-link dropdown-toggle" data-bs-toggle="dropdown">
                <FaKey className="me-2"/> License
              </span>
                            <ul className="dropdown-menu">
                                <li><NavLink className="dropdown-item" to="/licenses/dfia"><FaFileAlt
                                    className="me-2"/> DFIA</NavLink></li>
                                <li><NavLink className="dropdown-item" to="/licenses/rodtep"><FaFileAlt
                                    className="me-2"/> RODTEP</NavLink></li>
                            </ul>
                        </li>

                        <li className="nav-item">
                            <NavLink className="nav-link" to="/allotment"><FaListAlt
                                className="me-2"/> Allotment</NavLink>
                        </li>

                        <li className="nav-item">
                            <NavLink className="nav-link" to="/bill-of-entry"><FaFileAlt className="me-2"/> Bill of
                                Entry</NavLink>
                        </li>

                        <li className="nav-item dropdown">
              <span className="nav-link dropdown-toggle" data-bs-toggle="dropdown">
                <FaCogs className="me-2"/> Master
              </span>
                            <ul className="dropdown-menu">
                                <li><NavLink className="dropdown-item" to="/master/company"><FaBuilding
                                    className="me-2"/> Company</NavLink></li>
                                <li><NavLink className="dropdown-item" to="/master/port"><FaWarehouse
                                    className="me-2"/> Port</NavLink></li>
                                <li><NavLink className="dropdown-item" to="/master/hs-codes"><FaBuilding
                                    className="me-2"/> HS Code</NavLink></li>
                                <li><NavLink className="dropdown-item" to="/master/item-heads"><FaBuilding
                                    className="me-2"/> Item Head</NavLink></li>
                                <li><NavLink className="dropdown-item" to="/master/item-names"><FaBuilding
                                    className="me-2"/> Item Name</NavLink></li>

                                <li><NavLink className="dropdown-item" to="/master/sion"><FaListAlt
                                    className="me-2"/>Sion Norms</NavLink>
                                </li>
                            </ul>
                        </li>

                        <li className="nav-item dropdown">
                              <span className="nav-link dropdown-toggle" data-bs-toggle="dropdown">
                                <FaBoxes className="me-2"/> Additional
                              </span>
                            <ul className="dropdown-menu">
                                <li><NavLink className="dropdown-item" to="/addtional/ledger"><FaFileUpload
                                    className="me-2"/> Upload Ledger</NavLink></li>
                                <li><NavLink className="dropdown-item" to="/addtional/fetch-boe"><FaDownload
                                    className="me-2"/> Fetch BOE</NavLink></li>
                            </ul>
                        </li>

                        <li className="nav-item dropdown">
              <span className="nav-link dropdown-toggle" data-bs-toggle="dropdown">
                <FaChartPie className="me-2"/> Reports
              </span>
                            <ul className="dropdown-menu">
                                <li><NavLink className="dropdown-item" to="/reports/item-search"><FaSearch
                                    className="me-2"/> Item Search</NavLink></li>
                                <li className="dropdown-submenu">
                                    <span className="dropdown-item">Biscuit DFIA</span>
                                    <ul className="dropdown-menu">
                                        <li><NavLink className="dropdown-item" to="/reports/biscuit/parle"><FaFileAlt
                                            className="me-2"/> PARLE</NavLink></li>
                                        <li><NavLink className="dropdown-item" to="/reports/biscuit/global"><FaFileAlt
                                            className="me-2"/> GLOBAL</NavLink></li>
                                        <li><NavLink className="dropdown-item"
                                                     to="/reports/biscuit/conversion"><FaFileAlt
                                            className="me-2"/> CONVERSION</NavLink></li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                    </ul>

                    <li className="nav-item dropdown ms-lg-3">
                        <a
                            className="nav-link dropdown-toggle d-flex align-items-center"
                            href="#"
                            role="button"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                        >
                            <FaUserCircle className="me-2"/>
                            <span className="d-none d-lg-inline text-white">
      {user?.fullName || user?.first_name || user?.username?.charAt(0).toUpperCase() + user?.username?.slice(1) || 'Account'}
    </span>
                        </a>
                        <ul className="dropdown-menu dropdown-menu-end user-dropdown">
                            <li>
                                <NavLink className="dropdown-item" to="/profile/edit">
                                    <FaCogs className="me-2"/> Edit Profile
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
                                <NavLink
                                    to="/logout"
                                    className={({isActive}) => `dropdown-item ${isActive ? 'active' : ''}`}
                                >
                                    <FaSignOutAlt className="me-2"/> Logout
                                </NavLink>
                            </li>
                        </ul>
                    </li>

                </div>
            </div>
        </nav>
    );
};

export default Navbar;