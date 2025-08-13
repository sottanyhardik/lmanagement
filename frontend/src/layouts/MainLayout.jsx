// src/layouts/MainLayout.jsx
import {Outlet} from 'react-router-dom';
import Navbar from './Navbar';

export default function MainLayout() {
    return (
        <div>
            {/* Accessibility: tab to skip straight to content */}
            <a href="#main" className="skip-link">Skip to content</a>

            {/* Your Navbar should have Bootstrap's `fixed-top` if you want it pinned */}
            <Navbar/>

            {/* Top padding so content isn’t hidden behind a fixed navbar */}
            <main id="main" className="main-content container-fluid">
                <Outlet/>
            </main>
        </div>
    );
}
