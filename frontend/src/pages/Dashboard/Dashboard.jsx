import React, {useContext} from 'react';
import {Container} from 'react-bootstrap'; // ✅ FIXED: Missing import
import AuthContext from '../../context/AuthContext.jsx';
import './Dashboard.css';
import ListControls from "../../components/ListControls";

const Dashboard = () => {
    const {username} = useContext(AuthContext);

    return (
        <Container className="mt-4">
            <ListControls
                title="📋 Dashboard"
                onlyHeader={false} // ✅ Optional: Set to true if you want only title
            />
        </Container>
    );
};

export default Dashboard;
