// src/pages/LedgerUpload.jsx
import React, {useRef, useState} from 'react';
import axios from '../api/axiosInstance';
import {Alert, Button, Card, Container, Form, ListGroup, Spinner} from 'react-bootstrap';
import ListControls from '../components/generic/ListControls.jsx';
import LedgerUploadResult from './LedgerUploadResult';
// If you use react-toastify elsewhere, you can import { toast } and swap alerts for toasts.

const LedgerUpload = () => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [response, setResponse] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        setErrorMsg('');
        setResponse(null);
        setFiles(Array.from(e.target.files || []));
    };

    const handleReset = () => {
        setFiles([]);
        setResponse(null);
        setErrorMsg('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!files.length) {
            setErrorMsg('Please choose at least one CSV file.');
            return;
        }

        const formData = new FormData();
        // If your backend expects a different key (e.g., "files" or "ledgers"), update here:
        for (const file of files) formData.append('ledger', file);

        try {
            setUploading(true);
            const res = await axios.post('ledger/upload/', formData, {
                headers: {'Content-Type': 'multipart/form-data'},
            });
            setResponse(res.data || {});
            // toast.success('Upload complete'); // optional
        } catch (err) {
            console.error(err);
            setErrorMsg(
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to upload. Please try again.'
            );
            // toast.error('Failed to upload'); // optional
        } finally {
            setUploading(false);
        }
    };

    return (
        <Container className="mt-4">
            <ListControls title="📤 Upload Ledger CSV" onlyHeader={false}/>

            <Card className="mt-3 shadow-sm">
                <Card.Body>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group controlId="ledgerFiles" className="mb-3">
                            <Form.Label>Choose CSV file(s)</Form.Label>
                            <Form.Control
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                multiple
                                onChange={handleFileChange}
                                disabled={uploading}
                            />
                            <Form.Text muted>Accepted format: .csv</Form.Text>
                        </Form.Group>

                        {files.length > 0 && (
                            <div className="mb-3">
                                <div className="fw-semibold mb-1">Selected files:</div>
                                <ListGroup variant="flush">
                                    {files.map((f) => (
                                        <ListGroup.Item key={f.name}>{f.name}</ListGroup.Item>
                                    ))}
                                </ListGroup>
                            </div>
                        )}

                        {errorMsg && (
                            <Alert variant="danger" className="mb-3">
                                {errorMsg}
                            </Alert>
                        )}

                        <div className="d-flex gap-2">
                            <Button type="submit" variant="primary" disabled={uploading}>
                                {uploading ? (
                                    <>
                                        <Spinner animation="border" size="sm" className="me-2"/>
                                        Uploading…
                                    </>
                                ) : (
                                    'Upload'
                                )}
                            </Button>
                            <Button type="button" variant="outline-secondary" onClick={handleReset}
                                    disabled={uploading}>
                                Reset
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>

            {response && (
                <Card className="mt-3 shadow-sm">
                    <Card.Body>
                        <LedgerUploadResult
                            result={response.result || []}
                            errors={response.errors || []}
                        />
                    </Card.Body>
                </Card>
            )}
        </Container>
    );
};

export default LedgerUpload;
