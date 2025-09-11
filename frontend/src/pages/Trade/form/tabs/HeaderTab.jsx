// src/pages/Trade/form/tabs/HeaderTab.jsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Button, Col, Form, Row} from "react-bootstrap";
import {FaExternalLinkAlt, FaMagic, FaUpload} from "react-icons/fa";
import axios from "../../../../api/axiosInstance";
import AsyncCompanySelect from "../../../../components/AsyncSelect/AsyncCompanySelect";
import AsyncBOESelect from "../../../../components/AsyncSelect/AsyncBOESelect";

// ---------- helpers (local) ----------
const onlyLetters = (s = "") => s.replace(/[^A-Za-z]/g, "");
const companyPrefix = (name) => {
    const cleaned = onlyLetters(name || "").toUpperCase();
    if (!cleaned) return "INV";
    return cleaned.slice(0, 3); // first 3 letters
};
const fyLabel = (isoDate) => {
    const d = isoDate ? new Date(isoDate) : new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1..12
    const start = m >= 4 ? y : y - 1; // FY starts in April
    const end2 = String((start + 1) % 100).padStart(2, "0");
    return `${start}-${end2}`;
};

// Safe read of nested props coming from select options
const companyShape = (opt) => {
    if (!opt) return {};
    // AsyncCompanySelect often returns {..., data: { ...fullCompany }}
    const raw = opt?.data || opt;
    return {
        id: raw?.id ?? opt?.value,
        name: raw?.name,
        pan: raw?.pan || raw?.PAN || "",
        gst_number: raw?.gst_number || raw?.GST || "",
        address_line_1: raw?.address_line_1 || "",
        address_line_2: raw?.address_line_2 || "",
    };
};

export default function HeaderTab({data, errors = {}, setField}) {
    const isPurchase = data?.direction === "PURCHASE";
    const isSale = data?.direction === "SALE";

    // track if user typed invoice manually → we avoid overwriting their input
    const [invoiceTouched, setInvoiceTouched] = useState(false);
    const lastSuggestedRef = useRef("");

    // issuer for invoice series (prefer From company; if not present, fall back to To)
    const issuerCompany = useMemo(() => {
        return companyShape(data?.from_company)?.id
            ? companyShape(data?.from_company)
            : companyShape(data?.to_company);
    }, [data?.from_company, data?.to_company]);

    // ---------- SNAPSHOT PREFILL on company change ----------
    const prefillSnapshotsIfEmpty = useCallback(
        (side /* 'from' | 'to' */, compOpt) => {
            const c = companyShape(compOpt);
            if (!c?.id) return;

            const map =
                side === "to"
                    ? [
                        ["to_pan", "pan"],
                        ["to_gst", "gst_number"],
                        ["to_addr_line_1", "address_line_1"],
                        ["to_addr_line_2", "address_line_2"],
                    ]
                    : [
                        ["from_pan", "pan"],
                        ["from_gst", "gst_number"],
                        ["from_addr_line_1", "address_line_1"],
                        ["from_addr_line_2", "address_line_2"],
                    ];

            // set only if empty (do not overwrite user's edits)
            for (const [snapKey, compKey] of map) {
                if (!data[snapKey] && c[compKey]) {
                    setField(snapKey, c[compKey]);
                }
            }
        },
        [data, setField]
    );

    const handleFromCompanyChange = (v) => {
        setField("from_company", v);
        prefillSnapshotsIfEmpty("from", v);
    };
    const handleToCompanyChange = (v) => {
        setField("to_company", v);
        prefillSnapshotsIfEmpty("to", v);
    };

    // ---------- INVOICE SUGGESTION ----------
    const localSuggestInvoice = useCallback(() => {
        // local fallback uses issuerCompany name + current or chosen date + "0001"
        const prefix = companyPrefix(issuerCompany?.name);
        const fy = fyLabel(data?.invoice_date);
        return `${prefix}/${fy}/0001`;
    }, [issuerCompany?.name, data?.invoice_date]);

    const fetchServerSuggestion = useCallback(async () => {
        if (!isSale) return null; // only for SALE
        const issuerId = issuerCompany?.id;
        if (!issuerId) return null; // need a company
        try {
            const {data: resp} = await axios.get("trades/next-invoice/", {
                params: {
                    direction: "SALE",
                    issuer_company: issuerId,
                    invoice_date: data?.invoice_date || undefined,
                },
            });
            return resp?.invoice_number || null;
        } catch {
            return null;
        }
    }, [isSale, issuerCompany?.id, data?.invoice_date]);

    const maybePrefillInvoice = useCallback(
        async (force = false) => {
            if (!isSale) return;
            // If user has typed a custom invoice and not forcing, keep it.
            if (!force && (invoiceTouched || data?.invoice_number)) return;

            // try server
            const server = await fetchServerSuggestion();
            const suggestion = server || localSuggestInvoice();

            if (suggestion) {
                lastSuggestedRef.current = suggestion;
                setField("invoice_number", suggestion);
            }
        },
        [
            isSale,
            invoiceTouched,
            data?.invoice_number,
            fetchServerSuggestion,
            localSuggestInvoice,
            setField,
        ]
    );

    // Prefill on mount when SALE and on changes to issuer or date
    useEffect(() => {
        maybePrefillInvoice(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSale, issuerCompany?.id, data?.invoice_date]);

    // Manual "Auto" button
    const handleAutoInvoice = async () => {
        await maybePrefillInvoice(true);
        setInvoiceTouched(false);
    };

    // ---------- PURCHASE: Upload supplier invoice copy ----------
    const [uploading, setUploading] = useState(false);
    const onUploadFile = async (e) => {
        const file = e?.target?.files?.[0];
        if (!file) return;
        if (!data?.id) {
            // trade must be saved first
            e.target.value = "";
            return;
        }
        const form = new FormData();
        form.append("file", file);
        try {
            setUploading(true);
            const resp = await axios.post(
                `trades/${data.id}/upload-invoice-copy/`,
                form,
                {
                    headers: {"Content-Type": "multipart/form-data"},
                }
            );
            // update local header snapshot & link from server response
            const updated = resp?.data || {};
            if (updated.purchase_invoice_copy_url) {
                setField("purchase_invoice_copy_url", updated.purchase_invoice_copy_url);
            }
        } catch (err) {
            // optional: toast.error("Upload failed");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    return (
        <div>
            <Row className="g-2">
                <Col md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label>Direction</Form.Label>
                        <Form.Select
                            size="sm"
                            value={data.direction || "PURCHASE"}
                            onChange={(e) => setField("direction", e.target.value)}
                        >
                            <option value="PURCHASE">Purchase</option>
                            <option value="SALE">Sale</option>
                        </Form.Select>
                    </Form.Group>
                </Col>

                <Col md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label>
                            Invoice #
                            {isSale && (
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 ms-2 align-baseline"
                                    onClick={handleAutoInvoice}
                                    title="Suggest next invoice number"
                                >
                                    <FaMagic/> Auto
                                </Button>
                            )}
                        </Form.Label>
                        <Form.Control
                            size="sm"
                            value={data.invoice_number || ""}
                            onChange={(e) => {
                                setInvoiceTouched(true);
                                setField("invoice_number", e.target.value);
                            }}
                            placeholder={
                                isPurchase
                                    ? "Optional for Purchase"
                                    : "Auto-suggested for Sale (editable)"
                            }
                            isInvalid={!!errors.invoice_number}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.invoice_number}
                        </Form.Control.Feedback>
                        {isSale && lastSuggestedRef.current && (
                            <div className="form-text">
                                Suggested: {lastSuggestedRef.current}
                            </div>
                        )}
                    </Form.Group>
                </Col>

                <Col md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label>Invoice Date</Form.Label>
                        <Form.Control
                            size="sm"
                            type="date"
                            value={data.invoice_date || ""}
                            onChange={(e) => setField("invoice_date", e.target.value)}
                            isInvalid={!!errors.invoice_date}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.invoice_date}
                        </Form.Control.Feedback>
                        {isSale && <div className="form-text">FY: {fyLabel(data?.invoice_date)}</div>}
                    </Form.Group>
                </Col>

                {/* BOE only for SALE */}
                {isSale && (
                    <Col md={3}>
                        <Form.Group className="mb-2">
                            <Form.Label>BOE</Form.Label>
                            <AsyncBOESelect value={data.boe} onChange={(v) => setField("boe", v)}/>
                        </Form.Group>
                    </Col>
                )}
            </Row>

            <Row className="g-2">
                <Col md={6}>
                    <Form.Group className="mb-2">
                        <Form.Label>From Company</Form.Label>
                        <AsyncCompanySelect value={data.from_company} onChange={handleFromCompanyChange}/>
                        {errors.from_company_id && (
                            <div className="text-danger small">{errors.from_company_id}</div>
                        )}
                    </Form.Group>

                    {/* From snapshots */}
                    <Row className="g-2">
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Label>From PAN</Form.Label>
                                <Form.Control
                                    size="sm"
                                    value={data.from_pan || ""}
                                    onChange={(e) => setField("from_pan", e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Label>From GST</Form.Label>
                                <Form.Control
                                    size="sm"
                                    value={data.from_gst || ""}
                                    onChange={(e) => setField("from_gst", e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Form.Group className="mb-2">
                        <Form.Label>From Address Line 1</Form.Label>
                        <Form.Control
                            size="sm"
                            value={data.from_addr_line_1 || ""}
                            onChange={(e) => setField("from_addr_line_1", e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>From Address Line 2</Form.Label>
                        <Form.Control
                            size="sm"
                            value={data.from_addr_line_2 || ""}
                            onChange={(e) => setField("from_addr_line_2", e.target.value)}
                        />
                    </Form.Group>
                </Col>

                <Col md={6}>
                    <Form.Group className="mb-2">
                        <Form.Label>To Company</Form.Label>
                        <AsyncCompanySelect value={data.to_company} onChange={handleToCompanyChange}/>
                        {errors.to_company_id && (
                            <div className="text-danger small">{errors.to_company_id}</div>
                        )}
                    </Form.Group>

                    {/* To snapshots */}
                    <Row className="g-2">
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Label>To PAN</Form.Label>
                                <Form.Control
                                    size="sm"
                                    value={data.to_pan || ""}
                                    onChange={(e) => setField("to_pan", e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Label>To GST</Form.Label>
                                <Form.Control
                                    size="sm"
                                    value={data.to_gst || ""}
                                    onChange={(e) => setField("to_gst", e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Form.Group className="mb-2">
                        <Form.Label>To Address Line 1</Form.Label>
                        <Form.Control
                            size="sm"
                            value={data.to_addr_line_1 || ""}
                            onChange={(e) => setField("to_addr_line_1", e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>To Address Line 2</Form.Label>
                        <Form.Control
                            size="sm"
                            value={data.to_addr_line_2 || ""}
                            onChange={(e) => setField("to_addr_line_2", e.target.value)}
                        />
                    </Form.Group>
                </Col>
            </Row>

            <Form.Group className="mb-2">
                <Form.Label>Remarks</Form.Label>
                <Form.Control
                    as="textarea"
                    rows={2}
                    value={data.remarks || ""}
                    onChange={(e) => setField("remarks", e.target.value)}
                />
            </Form.Group>

            {/* PURCHASE: Upload supplier invoice copy (only for saved trades) */}
            {isPurchase && (
                <Row className="g-2 align-items-end">
                    <Col md={6}>
                        <Form.Group className="mb-2">
                            <Form.Label>Supplier Invoice Copy</Form.Label>
                            <div className="d-flex align-items-center">
                                <Form.Control
                                    type="file"
                                    size="sm"
                                    accept="application/pdf,image/*"
                                    onChange={onUploadFile}
                                    disabled={!data?.id}
                                />
                                <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    className="ms-2"
                                    disabled
                                    title={data?.id ? "Choose file to upload" : "Save the trade first"}
                                >
                                    <FaUpload className={uploading ? "fa-spin" : ""}/> Upload
                                </Button>
                            </div>
                            <div className="form-text">
                                {data?.id ? "Choose a file to upload" : "Save the trade header to enable uploads."}
                            </div>
                        </Form.Group>
                    </Col>
                    {!!data?.purchase_invoice_copy_url && (
                        <Col md="auto">
                            <a
                                className="btn btn-sm btn-outline-primary mt-2"
                                href={data.purchase_invoice_copy_url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                View Current <FaExternalLinkAlt/>
                            </a>
                        </Col>
                    )}
                </Row>
            )}
        </div>
    );
}
