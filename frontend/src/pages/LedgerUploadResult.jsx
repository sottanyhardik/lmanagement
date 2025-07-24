import React from 'react';
import {Badge, Card, ListGroup} from 'react-bootstrap';

const LedgerUploadResult = ({result = [], errors = []}) => {
    return (
        <div className="mt-4">
            {/* ✅ Success Summary */}
            {result.length > 0 &&
                result.map(({file, count, licenses}) => (
                    <Card className="mb-4 border-success shadow-sm" key={file}>
                        <Card.Header className="bg-success text-white fw-bold">
                            ✅ {file} — {count} License{count > 1 ? 's' : ''} Processed
                        </Card.Header>
                        <Card.Body>
                            <p className="mb-2 text-muted">Licenses Created:</p>
                            <ListGroup variant="flush" className="license-list">
                                {licenses.map((lic, idx) => (
                                    <ListGroup.Item key={idx}>
                                        <Badge bg="success" className="me-2">✔</Badge>
                                        {lic}
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </Card.Body>
                    </Card>
                ))
            }

            {/* ❌ Error Summary */}
            {errors.length > 0 && (
                <Card className="border-danger shadow-sm">
                    <Card.Header className="bg-danger text-white fw-bold">
                        ❌ Errors Encountered
                    </Card.Header>
                    <Card.Body>
                        <ListGroup variant="flush">
                            {errors.map((err, idx) => (
                                <ListGroup.Item key={idx} className="text-danger">
                                    <Badge bg="danger" className="me-2">!</Badge>
                                    {err}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Card.Body>
                </Card>
            )}
        </div>
    );
};

export default LedgerUploadResult;
