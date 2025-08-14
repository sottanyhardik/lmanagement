import {useRef} from 'react';
import {Outlet} from 'react-router-dom';
import Navbar from './Navbar';

export default function MainLayout() {
    const navbarRef = useRef();

    return (
        <div className="d-flex flex-column min-vh-100">
            {/* Fixed Navbar */}
            <Navbar ref={navbarRef}/>

            {/* Main Content with padding to avoid overlap */}
            <main id="main" className="container-fluid flex-grow-1 pt-navbar">
                <Outlet/>
            </main>
        </div>
    );
}
