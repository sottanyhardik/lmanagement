import React, {useState} from "react";
import {Button, Form} from "react-bootstrap";
import {FaCloudUploadAlt, FaLink} from "react-icons/fa";
import axios from "../../../api/axiosInstance";
import {toast} from "react-toastify";

export default function InvoiceCopyUploader({tradeId, fileUrl, onUploaded}) {
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);

    const handleUpload = async () => {
        if (!tradeId) {
            toast.info("Save the trade first to enable uploads.");
            return;
        }
        if (!file) {
            toast.error("Please select a file to upload.");
            return;
        }
        const form = new FormData();
        form.append("file", file);

        try {
            setBusy(true);
            const {data} = await axios.post(`trades/${tradeId}/upload-invoice-copy/`, form);
            toast.success("Invoice copy uploaded");
            setFile(null);
            onUploaded?.(data); // server returns full trade serializer
        } catch (e) {
            const msg = e?.response?.data?.detail || "Upload failed";
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="d-flex flex-column gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
                <Form.Control
                    type="file"
                    size="sm"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept="application/pdf,image/*"
                    disabled={!tradeId || busy}
                    style={{maxWidth: 360}}
                />
                <Button
                    size="sm"
                    variant="primary"
                    onClick={handleUpload}
                    disabled={!tradeId || busy || !file}
                    title={!tradeId ? "Save the trade first" : "Upload supplier invoice copy"}
                >
                    <FaCloudUploadAlt className="me-1"/>
                    Upload
                </Button>
            </div>

            {fileUrl && (
                <div className="small">
                    <FaLink className="me-1"/>
                    <a href={fileUrl} target="_blank" rel="noreferrer">
                        View current invoice copy
                    </a>
                </div>
            )}

            {!tradeId && (
                <div className="text-muted small">Save the trade to enable uploading the invoice copy.</div>
            )}
        </div>
    );
}
