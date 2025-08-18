// src/components/auth/AuthShell.jsx
import React from 'react';
import {Card, Col, Container, Row} from 'react-bootstrap';

const AuthShell = ({title = 'License Manager', subtitle, children, footer}) => {
    return (
        <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary"
                   style={{background: 'url(/static/bg-import-export.png) center/cover no-repeat fixed'}}>
            <Row className="w-100 justify-content-center px-2">
                <Col xs={12} sm={10} md={7} lg={5} xl={4}>
                    <Card className="shadow">
                        <Card.Body className="p-4">
                            <div className="text-center mb-3">
                                <img src="/static/Logo.png" alt="Logo" width={56} height={56} className="mb-2"/>
                                {!!title && <h5 className="mb-0 fw-bold">{title}</h5>}
                                {!!subtitle && <div className="text-muted">{subtitle}</div>}
                            </div>

                            {children}

                            {footer && <div className="mt-3">{footer}</div>}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default AuthShell;
