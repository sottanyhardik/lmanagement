import React, {useState} from 'react';
import axios from '../api/axiosInstance';
import {Card, CardBody, Container} from 'react-bootstrap';
import ListControls from "../components/ListControls"; // your configured Axios instance
import LedgerUploadResult from "./LedgerUploadResult"; // your configured Axios instance

const LedgerUpload = () => {
    const [files, setFiles] = useState([]);
    const [response, setResponse] = useState(null);

    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const formData = new FormData();
        for (let file of files) {
            formData.append('ledger', file);
        }

        try {
            const res = await axios.post('/api/ledger/upload/', formData, {
                headers: {'Content-Type': 'multipart/form-data'}
            });
            setResponse(res.data);
        } catch (err) {
            console.error(err);
            alert("Failed to upload");
        }
    };

    return (
        <Container className="mt-4">
            <ListControls
                title="📤 Upload Ledger CSV"
                onlyHeader={false}
            />

            <Card className="mt-4">
                <CardBody>

                    <form onSubmit={handleSubmit}>
                        <input type="file" accept=".csv" multiple onChange={handleFileChange}/>
                        <button type="submit" className="btn btn-primary mt-2">Upload</button>
                    </form>
                </CardBody>
            </Card>
            {response && (
                <Card>
                    <CardBody>

                        <div className="mt-4">
                            <LedgerUploadResult
                                result={response.result || []}
                                errors={response.errors || []}
                            />
                        </div>
                    </CardBody>
                </Card>

            )}
        </Container>
    );
};

export default LedgerUpload;
