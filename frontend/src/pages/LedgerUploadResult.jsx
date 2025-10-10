// src/components/LedgerUploadResult.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {Badge, Card, ListGroup} from 'react-bootstrap';

const pluralize = (word, n) => `${word}${n === 1 ? '' : 's'}`;

const LedgerUploadResult = ({result = [], errors = []}) => {
    const hasResults = Array.isArray(result) && result.length > 0;
    const hasErrors = Array.isArray(errors) && errors.length > 0;

    if (!hasResults && !hasErrors) {
        return null; // nothing to show
    }

    return (
        <div className="mt-4">
            {/* ✅ Success Summary */}
            {hasResults &&
                result.map(({file, count, licenses = []}) => {
                    const processed = Number.isFinite(count) ? count : licenses.length;
                    const headerText = `${file || 'File'} — ${processed} ${pluralize('License', processed)} Processed`;

                    return (
                        <Card className="mb-4 border-success shadow-sm" key={String(file ?? headerText)}>
                            <Card.Header className="bg-success text-white fw-bold">
                                ✅ {headerText}
                            </Card.Header>
                            <Card.Body>
                                {licenses.length > 0 ? (
                                    <>
                                        <p className="mb-2 text-muted">Licenses Created:</p>
                                        <ListGroup variant="flush" className="license-list">
                                            {licenses.map((lic) => (
                                                <ListGroup.Item key={String(lic)}>
                                                    <Badge bg="success" className="me-2">✔</Badge>
                                                    {lic}
                                                </ListGroup.Item>
                                            ))}
                                        </ListGroup>
                                    </>
                                ) : (
                                    <div className="text-muted">No licenses returned for this file.</div>
                                )}
                            </Card.Body>
                        </Card>
                    );
                })}

            {/* ❌ Error Summary */}
            {hasErrors && (
                <Card className="border-danger shadow-sm" aria-live="polite">
                    <Card.Header className="bg-danger text-white fw-bold">
                        ❌ Errors Encountered
                    </Card.Header>
                    <Card.Body>
                        <ListGroup variant="flush">
                            {errors.map((err, idx) => (
                                <ListGroup.Item key={`${idx}-${String(err).slice(0, 24)}`} className="text-danger">
                                    <Badge bg="danger" className="me-2">!</Badge>
                                    {String(err)}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Card.Body>
                </Card>
            )}
        </div>
    );
};

LedgerUploadResult.propTypes = {
    result: PropTypes.arrayOf(
        PropTypes.shape({
            file: PropTypes.string,
            count: PropTypes.number,              // optional; falls back to licenses.length
            licenses: PropTypes.arrayOf(
                PropTypes.oneOfType([PropTypes.string, PropTypes.number])
            ),
        })
    ),
    errors: PropTypes.arrayOf(
        PropTypes.oneOfType([PropTypes.string, PropTypes.object])
    ),
};

export default LedgerUploadResult;
