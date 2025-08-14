import React, {useContext} from 'react';
import {Card, CardHeader, Container} from 'react-bootstrap'; // ✅ FIXED: Missing import
import AuthContext from '../../context/AuthContext';
import './Dashboard.css';
import ListControls from "../../components/ListControls";

const Dashboard = () => {
    const {user} = useContext(AuthContext);

    return (
        <Container className="mt-4">
            <ListControls
                title="📊 Dashboard"
                onlyHeader={false} // ✅ Optional: Set to true if you want only title
            />
            <Card>
                <CardHeader>
                    <h4>Hi {user.username.toUpperCase()}</h4>
                </CardHeader>
            </Card>
        </Container>
    );
};

export default Dashboard;
