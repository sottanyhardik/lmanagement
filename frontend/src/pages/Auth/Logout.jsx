import React, {useContext, useEffect} from 'react';
import {Container, Spinner} from 'react-bootstrap';
import AuthContext from '../../context/AuthContext';

const Logout = () => {
    const {logoutUser} = useContext(AuthContext);

    useEffect(() => {
        logoutUser();
    }, [logoutUser]);

    return (
        <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center"
                   style={{background: 'url(/bg-import-export.png) center/cover no-repeat fixed'}}>
            <div className="text-center text-muted">
                <Spinner animation="border" size="sm" className="me-2"/>
                Logging out…
            </div>
        </Container>
    );
};

export default Logout;
