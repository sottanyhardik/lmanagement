import {Outlet, useLocation} from 'react-router-dom';
import Navbar from '../layouts/Navbar';

const MainLayout = () => {
    const location = useLocation();

    const hideNavbarPaths = ['/login', '/forgot-password', '/reset'];
    const shouldHideNavbar = hideNavbarPaths.some(path => location.pathname.startsWith(path));

    return (
        <div>
            {!shouldHideNavbar && <Navbar/>}
            <main className="main-content">
                <Outlet/>
            </main>
        </div>
    );
};

export default MainLayout;
