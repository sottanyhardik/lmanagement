import React, {useContext} from 'react';
import AuthContext from '../../context/AuthContext.jsx';
import './Dashboard.css';

const Dashboard = () => {
    const {user} = useContext(AuthContext);

    return (
        <div className="dashboard">
            <h1>Welcome, {user?.username}!</h1>
            <p>This is your dashboard.</p>
        </div>
    );
};

export default Dashboard;
