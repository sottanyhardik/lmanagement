// src/pages/License/components/PurchaseForm.jsx
import React, {useEffect, useMemo, useState} from "react";
import {Badge, Button, Col, Form, Row} from "react-bootstrap";
import axios from "../../../api/axiosInstance";
import {toast} from "react-toastify";
import AsyncCompanySelect from "../../../components/AsyncSelect/AsyncCompanySelect";
import EntitySelect from "../../../components/EntitySelect";

const toNum = (v) => {
    const n = parseFloat(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
};
const fmt2 = (n) =>
    Number.isFinite(Number(n))
        ? Number(n).toLocaleString("en-IN", {maximumFractionDigits: 2})
        : "-";
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000; // max 3 decimals

const MODE = {AMOUNT: "AMOUNT", QTY: "QTY"};
const SRC = {FOB_INR: "FOB_INR", CIF_INR: "CIF_INR", CIF_USD: "CIF_USD"};

export default function PurchaseForm({
                                         licenseId,
                                         initial = null,       // existing row for edit
                                         purchaseId = null,    // numeric id or null
                                         compact = false,
                                         onSaved,
                                         onCancel,
                                     }) {
    // parties
    const [entity, setEntity] = useState(null);
    const [supplier, setSupplier] = useState(null);
    const [pan, setPan] = useState("");
    const [gst, setGst] = useState("");

    // invoice
    const [invoiceNo, setInvoiceNo] = useState("");
    const [invoiceDate, setInvoiceDate] = useState("");
    const [invoiceFile, setInvoiceFile] = useState(null);

    // mode
    const [mode, setMode] = useState(MODE.AMOUNT);

    // amount-based
    const [amountSource, setAmountSource] = useState(SRC.FOB_INR);
    const [fobInr, setFobInr] = useState("");
    const [cifInr, setCifInr] = useState("");
    const [cifUsd, setCifUsd] = useState("");
    const [exRate, setExRate] = useState("");
    const [exRateTouched, setExRateTouched] = useState(false); // stop auto when edited
    const [ratePct, setRatePct] = useState("");                // 3 d.p. max
    const [billAmount, setBillAmount] = useState("");          // 2 d.p.

    // quantity-based (single product)
    const [productName, setProductName] = useState("");
    const [qtyKg, setQtyKg] = useState("");
    const [rateInr, setRateInr] = useState("");

    // ─── hydrate on edit ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!initial) return;

        setEntity(
            initial.purchasing_entity
                ? {id: initial.purchasing_entity, name: initial.purchasing_entity_name}
                : null
        );
        setSupplier(
            initial.supplier
                ? {
                    id: initial.supplier,
                    name: initial.supplier_name,
                    pan: initial.supplier_pan,
                    gst_number: initial.supplier_gst,
                }
                : null
        );
        setPan(initial.supplier_pan || "");
        setGst(initial.supplier_gst || "");

        setInvoiceNo(initial.invoice_number || "");
        setInvoiceDate(initial.invoice_date || "");

        setMode(initial.mode || MODE.AMOUNT);
        setAmountSource(initial.amount_source || SRC.FOB_INR);
        setFobInr(String(initial.fob_inr ?? ""));
        setCifInr(String(initial.cif_inr ?? ""));
        setCifUsd(String(initial.cif_usd ?? ""));
        setExRate(
            initial.exchange_rate !== undefined && initial.exchange_rate !== null
                ? String(round3(initial.exchange_rate))
                : ""
        );

        // “Rate %” — clamp to 3 d.p. if present
        if (initial.markup_pct !== undefined && initial.markup_pct !== null && initial.markup_pct !== "") {
            setRatePct(String(round3(initial.markup_pct)));
        } else {
            setRatePct("");
        }

        // Accept bill from either field name
        const initBill = initial.bill_amount ?? initial.amount_inr;
        setBillAmount(initBill !== undefined && initBill !== null ? String(round2(initBill)) : "");

        setProductName(initial.product_name || "");
        setQtyKg(String(initial.quantity_kg ?? ""));
        setRateInr(String(initial.rate_inr ?? ""));

        setExRateTouched(false);
    }, [initial]);

    // autofill PAN/GST when supplier changes
    useEffect(() => {
        if (supplier?.id) {
            setPan(supplier.pan || "");
            setGst(supplier.gst_number || "");
        }
    }, [supplier]);

    // ─── auto-calc Exchange Rate (not used in bill calc, but helpful) ─────────────
    useEffect(() => {
        if (mode !== MODE.AMOUNT) return;
        if (exRateTouched) return;
        const usd = toNum(cifUsd);
        const inr = toNum(cifInr);
        if (usd > 0 && inr > 0) setExRate(String(round3(inr / usd)));
    }, [mode, cifUsd, cifInr, exRateTouched]);

    // chosen basis for % (no ER for USD case)
    const basis = useMemo(() => {
        if (mode !== MODE.AMOUNT) return 0;
        if (amountSource === SRC.FOB_INR) return toNum(fobInr);
        if (amountSource === SRC.CIF_INR) return toNum(cifInr);
        return toNum(cifUsd); // USD basis directly per your rule
    }, [mode, amountSource, fobInr, cifInr, cifUsd]);

    // raw bill = basis * (rate % / 100)
    const rawBill = useMemo(() => {
        if (mode !== MODE.AMOUNT) return 0;
        const pct = toNum(ratePct);
        return round2(basis * (pct / 100));
    }, [mode, basis, ratePct]);

    // keep bill amount synced with formula while typing % or basis
    useEffect(() => {
        if (mode !== MODE.AMOUNT) return;
        setBillAmount(rawBill ? String(rawBill) : "");
    }, [mode, rawBill]);

    // when bill amount is edited manually → recompute rate % (3 d.p.)
    const handleBillChange = (v) => {
        setBillAmount(v);
        if (mode !== MODE.AMOUNT) return;
        const bill = toNum(v);
        if (basis > 0) {
            const pct = (bill / basis) * 100;
            setRatePct(String(round3(pct)));
        } else {
            setRatePct("");
        }
    };

    // rounding helpers (nearest rupee)
    const rNearest = useMemo(() => Math.round(toNum(billAmount)), [billAmount]);
    const rCeil = useMemo(() => Math.ceil(toNum(billAmount)), [billAmount]);
    const rFloor = useMemo(() => Math.floor(toNum(billAmount)), [billAmount]);

    // qty mode total
    const qtyAmount = useMemo(
        () => round2(toNum(qtyKg) * toNum(rateInr)),
        [qtyKg, rateInr]
    );

    const canSubmit =
        (purchaseId || licenseId) &&
        (supplier?.id || initial?.supplier) &&
        (mode === MODE.AMOUNT ? toNum(billAmount) > 0 : qtyAmount > 0);

    const submit = async () => {
        const fd = new FormData();
        if (!purchaseId) fd.append("license", licenseId);

        if (entity?.id) fd.append("purchasing_entity", entity.id);
        if (supplier?.id) fd.append("supplier", supplier.id);
        if (pan !== "") fd.append("supplier_pan", pan);
        if (gst !== "") fd.append("supplier_gst", gst);

        if (invoiceNo) fd.append("invoice_number", invoiceNo);
        if (invoiceDate) fd.append("invoice_date", invoiceDate);
        if (invoiceFile) fd.append("invoice_copy", invoiceFile);

        fd.append("mode", mode);

        if (mode === MODE.AMOUNT) {
            fd.append("amount_source", amountSource);
            fd.append("fob_inr", toNum(fobInr));
            fd.append("cif_inr", toNum(cifInr));
            fd.append("cif_usd", toNum(cifUsd));
            if (exRate !== "") fd.append("exchange_rate", round3(toNum(exRate))); // 3 d.p.
            if (ratePct !== "") fd.append("markup_pct", round3(toNum(ratePct))); // 3 d.p.
            fd.append("bill_amount", round2(toNum(billAmount)));                    // 2 d.p.
        } else {
            fd.append("product_name", productName || "");
            fd.append("quantity_kg", toNum(qtyKg));
            fd.append("rate_inr", toNum(rateInr));
        }

        try {
            if (purchaseId) {
                await axios.patch(`/license-purchases/${purchaseId}/`, fd, {
                    headers: {"Content-Type": "multipart/form-data"},
                });
                toast.success("Purchase updated");
            } else {
                await axios.post("/license-purchases/", fd, {
                    headers: {"Content-Type": "multipart/form-data"},
                });
                toast.success("Purchase created");
            }
            onSaved?.();
        } catch (e) {
            const msg =
                e?.response?.data?.error ||
                e?.response?.data?.detail ||
                e?.message ||
                "Failed to save purchase";
            toast.error(msg);
        }
    };

    return (
        <div className={compact ? "" : "border rounded p-3 bg-light"}>
            {/* Parties */}
            <Row className="g-3">
                <Col md={compact ? 4 : 6}>
                    <Form.Label className="mb-1">Purchase by (Entity)</Form.Label>
                    <EntitySelect value={entity} onChange={setEntity}/>
                </Col>
                <Col md={compact ? 4 : 6}>
                    <Form.Label className="mb-1">Supplier</Form.Label>
                    <AsyncCompanySelect
                        value={supplier}
                        onChange={setSupplier}
                        placeholder="Search supplier…"
                    />
                </Col>
                <Col md={3}>
                    <Form.Label className="mb-1">PAN</Form.Label>
                    <Form.Control
                        size="sm"
                        value={pan}
                        onChange={(e) => setPan(e.target.value)}
                    />
                </Col>
                <Col md={3}>
                    <Form.Label className="mb-1">GST</Form.Label>
                    <Form.Control
                        size="sm"
                        value={gst}
                        onChange={(e) => setGst(e.target.value)}
                    />
                </Col>
                <Col md={3}>
                    <Form.Label className="mb-1">Invoice No</Form.Label>
                    <Form.Control
                        size="sm"
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                    />
                </Col>
                <Col md={3}>
                    <Form.Label className="mb-1">Invoice Date</Form.Label>
                    <Form.Control
                        size="sm"
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                </Col>
                <Col md={compact ? 6 : 6}>
                    <Form.Label className="mb-1">Invoice Copy</Form.Label>
                    <Form.Control
                        size="sm"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                    />
                </Col>
            </Row>

            <hr/>

            {/* Mode switch */}
            <Row className="g-2 mb-2">
                <Col>
                    <div className="d-flex gap-4">
                        <Form.Check
                            inline
                            type="radio"
                            label="Amount-based"
                            checked={mode === MODE.AMOUNT}
                            onChange={() => setMode(MODE.AMOUNT)}
                        />
                        <Form.Check
                            inline
                            type="radio"
                            label="Quantity-based"
                            checked={mode === MODE.QTY}
                            onChange={() => setMode(MODE.QTY)}
                        />
                    </div>
                </Col>
            </Row>

            {mode === MODE.AMOUNT ? (
                <>
                    <Row className="g-3">
                        <Col md={12}>
                            <Form.Label className="mb-1">Calculate bill from</Form.Label>
                            <div className="d-flex gap-4 flex-wrap">
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="FOB (₹)"
                                    checked={amountSource === SRC.FOB_INR}
                                    onChange={() => setAmountSource(SRC.FOB_INR)}
                                />
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="CIF (₹)"
                                    checked={amountSource === SRC.CIF_INR}
                                    onChange={() => setAmountSource(SRC.CIF_INR)}
                                />
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="CIF ($)"
                                    checked={amountSource === SRC.CIF_USD}
                                    onChange={() => setAmountSource(SRC.CIF_USD)}
                                />
                            </div>
                        </Col>

                        <Col md={3}>
                            <Form.Label className="mb-1">FOB (₹)</Form.Label>
                            <Form.Control
                                size="sm"
                                inputMode="decimal"
                                value={fobInr}
                                onChange={(e) => setFobInr(e.target.value)}
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="mb-1">CIF (₹)</Form.Label>
                            <Form.Control
                                size="sm"
                                inputMode="decimal"
                                value={cifInr}
                                onChange={(e) => setCifInr(e.target.value)}
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="mb-1">CIF ($)</Form.Label>
                            <Form.Control
                                size="sm"
                                inputMode="decimal"
                                value={cifUsd}
                                onChange={(e) => setCifUsd(e.target.value)}
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="mb-1">
                                Exchange Rate{" "}
                                {!exRateTouched && toNum(cifUsd) > 0 && toNum(cifInr) > 0 ? (
                                    <Badge bg="secondary" pill className="ms-1">auto</Badge>
                                ) : null}
                            </Form.Label>
                            <Form.Control
                                size="sm"
                                inputMode="decimal"
                                value={exRate}
                                onChange={(e) => {
                                    setExRateTouched(true);
                                    const v = e.target.value;
                                    if (v === "" || isNaN(Number(v))) setExRate(v);
                                    else setExRate(String(round3(v)));
                                }}
                                placeholder="e.g. 87.900"
                            />
                        </Col>

                        <Col md={3}>
                            <Form.Label className="mb-1">Rate %</Form.Label>
                            <Form.Control
                                size="sm"
                                inputMode="decimal"
                                value={ratePct}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") {
                                        setRatePct("");
                                        return;
                                    }
                                    setRatePct(String(round3(toNum(v)))); // clamp to 3 d.p.
                                }}
                                placeholder="e.g. 5"
                            />
                        </Col>

                        <Col md={5}>
                            <Form.Label className="mb-1">Bill Amount</Form.Label>
                            <Form.Control
                                size="sm"
                                inputMode="decimal"
                                value={billAmount}
                                onChange={(e) => handleBillChange(e.target.value)}
                            />
                            <div className="mt-2 d-flex flex-wrap gap-2 small">
                                <Badge bg="light" text="dark">
                                    {fmt2(basis)} × {toNum(ratePct)}% = {fmt2(rawBill)}
                                </Badge>
                                <Badge bg="secondary" role="button" title="Round to nearest"
                                       onClick={() => setBillAmount(String(rNearest))}>
                                    ≈ {fmt2(rNearest)}
                                </Badge>
                                <Badge bg="success" role="button" title="Round up"
                                       onClick={() => setBillAmount(String(rCeil))}>
                                    ▲ {fmt2(rCeil)}
                                </Badge>
                                <Badge bg="danger" role="button" title="Round down"
                                       onClick={() => setBillAmount(String(rFloor))}>
                                    ▼ {fmt2(rFloor)}
                                </Badge>
                            </div>
                        </Col>
                    </Row>
                </>
            ) : (
                <>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Label className="mb-1">Product</Form.Label>
                            <Form.Control
                                size="sm"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                placeholder="e.g. COCOA"
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="mb-1">Qty (kg)</Form.Label>
                            <Form.Control
                                size="sm"
                                className="text-end"
                                inputMode="decimal"
                                value={qtyKg}
                                onChange={(e) => setQtyKg(e.target.value)}
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="mb-1">Rate (₹/kg)</Form.Label>
                            <Form.Control
                                size="sm"
                                className="text-end"
                                inputMode="decimal"
                                value={rateInr}
                                onChange={(e) => setRateInr(e.target.value)}
                            />
                        </Col>
                        <Col md={12}>
                            <Badge bg="success">Total ₹ {fmt2(qtyAmount)}</Badge>
                        </Col>
                    </Row>
                </>
            )}

            <div className="d-flex justify-content-end gap-2 mt-3">
                {onCancel && (
                    <Button variant="outline-secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button onClick={submit} disabled={!canSubmit}>
                    {purchaseId ? "Update" : "Save"} Purchase
                </Button>
            </div>
        </div>
    );
}
