// src/pages/License/sale/LicenseInvoiceForm.jsx
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Button, Card, Col, Form, Row, Spinner} from "react-bootstrap";
import EntitySelect from "../../../components/EntitySelect.jsx";
import AsyncCompanySelect from "../../../components/AsyncSelect/AsyncCompanySelect.jsx";
import ValidatedInput from "../../../components/ValidatedInput";
import {toast} from "react-toastify";
import axios from "../../../api/axiosInstance";

import {computeTotals, makeFullLicenseRow, makeItemWiseDefaults, recalcRowAmount,} from "./hooks/useInvoiceCalc";
import {validateInvoiceForm} from "./utils/validators";
import SaleItemsTable from "./components/SaleItemsTable";

export default function LicenseInvoiceForm({
                                               entry,
                                               onSaved,
                                               initialSaleType = "item",       // 'item' | 'full' for NEW
                                               fullBasis = "cif_inr",          // 'cif_inr' | 'fob_inr' default basis for FULL
                                           }) {
    const [loading, setLoading] = useState(true);

    // multiple-invoice support
    const [invoiceList, setInvoiceList] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState("NEW"); // "NEW" | id

    // core state
    const [saleType, setSaleType] = useState(initialSaleType);
    const [entity, setEntity] = useState(null);
    const [toCompany, setToCompany] = useState({});
    const [billingMode, setBillingMode] = useState("kg");
    const [saleBasis, setSaleBasis] = useState(fullBasis);
    const [items, setItems] = useState([]);
    const [invoice, setInvoice] = useState(null);
    const [invoiceDate, setInvoiceDate] = useState(""); // yyyy-mm-dd
    const [isEditing, setIsEditing] = useState(true);
    const [errors, setErrors] = useState({});

    const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
    useEffect(() => setSaleBasis(fullBasis), [fullBasis]);

    const totals = computeTotals((invoice && !isEditing ? (invoice.items || []) : items) || []);

    const formTopRef = useRef(null);

    const hydrateToCompanyFromInvoice = (inv) =>
        setToCompany({
            id: inv?.to_company_id ?? undefined,    // harmless if BE doesn't return it
            name: inv?.to_company_name || "",
            pan: inv?.to_company_pan || "",
            gst_number: inv?.to_company_gst_number || "",
            address_line_1: inv?.to_company_address_line_1 || "",
            address_line_2: inv?.to_company_address_line_2 || "",
        });

    const prefillFullFOB = (lic) => {
        // If you keep FOB in export items, sum them; else 0
        try {
            const exp = lic?.export_license || [];
            const s = exp.reduce((a, x) => a + Number(x?.fob_inr || 0), 0);
            return Number.isFinite(s) ? s : 0;
        } catch {
            return 0;
        }
    };

    const reinitItemsForSaleType = (lic, nextType, keepIfEditingExisting = false) => {
        if (!lic) return;
        if (keepIfEditingExisting && selectedInvoiceId !== "NEW") return;

        if (nextType === "full") {
            const row = (makeFullLicenseRow(lic) || [])[0] || {
                sr_id: lic?.import_license?.[0]?.id || null,
                license_no: lic?.license_number || "",
                qty: 0, cif_fc: 0, cif_inr: 0, fob_inr: 0, rate: 0, amount: 0,
            };
            // prefill FOB for convenience; editable in table
            row.fob_inr = row.fob_inr || prefillFullFOB(lic);
            setItems([row]);
        } else {
            setItems(makeItemWiseDefaults(lic));
        }
    };

    // row handlers
    const onRateChange = (idx, newRate) => {
        const arr = [...items];
        arr[idx].rate = newRate === "" ? "" : Number(newRate);
        arr[idx].amount = recalcRowAmount(arr[idx], {saleType, billingMode, saleBasis});
        setItems(arr);
        setErrors(validateInvoiceForm({toCompany, entity, items: arr}));
    };

    const onFieldChange = (idx, field, value) => {
        const arr = [...items];
        arr[idx][field] = value === "" ? "" : Number(value);
        arr[idx].amount = recalcRowAmount(arr[idx], {saleType, billingMode, saleBasis});
        setItems(arr);
        setErrors(validateInvoiceForm({toCompany, entity, items: arr}));
    };

    const onRemoveRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

    // toggles / validation
    const validate = () => {
        const newErrors = validateInvoiceForm({toCompany, entity, items});
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleBillingModeChange = (mode) => {
        setBillingMode(mode);
        setItems((prev) =>
            prev.map((it) => ({
                ...it,
                amount: recalcRowAmount(it, {saleType, billingMode: mode, saleBasis}),
            }))
        );
    };

    const handleSaleBasisChange = (basis) => {
        setSaleBasis(basis);
        setItems((prev) =>
            prev.map((it) => ({
                ...it,
                amount: recalcRowAmount(it, {saleType, billingMode, saleBasis: basis}),
            }))
        );
    };

    // UI -> API mapping
    const toApiBillingMode = () => {
        if (saleType === "item") return billingMode === "kg" ? "kg" : "cif";
        return saleBasis === "fob_inr" ? "fob" : "cif";
    };

    // actions
    const handleSave = async () => {
        if (!validate()) {
            toast.error("Please fix validation errors.");
            return;
        }
        try {
            const payload = {
                sale_type: saleType,
                from_entity: entity?.id,
                to_company_name: toCompany.name,
                to_company_pan: toCompany.pan,
                to_company_gst_number: toCompany.gst_number,
                to_company_address_line_1: toCompany.address_line_1,
                to_company_address_line_2: toCompany.address_line_2,
                invoice_number: (invoice?.invoice_number || "").trim(), // blank => BE auto-generate
                ...(invoiceDate ? {invoice_date: invoiceDate} : {}),
                billing_mode: toApiBillingMode(),
                items: items.map((it) => ({
                    sr_number: it.sr_id || it.sr_number, // PK id
                    license_no: it.license_no,
                    hsn_code: it.hsn_code,
                    qty: it.qty,
                    cif_fc: it.cif_fc,
                    cif_inr: it.cif_inr,
                    fob_inr: it.fob_inr,
                    rate: it.rate,
                    amount: +(+it.amount).toFixed(2),
                })),
                // BE recomputes; we also send to help UI mirrors
                total_amount: totals.amount,
                total_qty: totals.qty,
                total_cif_fc: totals.cif_fc,
                total_cif_inr: totals.cif_inr,
                total_fob_inr: totals.fob_inr,
            };

            const res = invoice?.id
                ? await axios.put(`invoices/${invoice.id}/`, payload)
                : await axios.post("invoices/", payload);

            const inv = res.data;
            inv.items = (inv.items || []).map((it) => ({
                ...it,
                rate: Number(it.rate || 0),
                amount: Number(it.amount || 0),
                qty: Number(it.qty || 0),
            }));

            setInvoice(inv);
            setIsEditing(false);
            setInvoiceDate(String(inv.invoice_date || "").slice(0, 10));
            setEntity(inv.from_entity ? {id: inv.from_entity} : null);
            hydrateToCompanyFromInvoice(inv);

            // refresh invoice dropdown
            setInvoiceList((prev) => {
                const exists = prev.some((x) => x.id === inv.id);
                return exists ? prev.map((x) => (x.id === inv.id ? inv : x)) : [inv, ...prev];
            });
            setSelectedInvoiceId(inv.id);

            toast.success("Invoice saved");
            onSaved && onSaved(entry.id);
        } catch (err) {
            const apiErrors = err.response?.data;
            const newErrors = {};
            if (apiErrors && typeof apiErrors === "object") {
                for (const key in apiErrors) {
                    if (Array.isArray(apiErrors[key])) newErrors[key] = apiErrors[key].join(", ");
                    else if (typeof apiErrors[key] === "object") {
                        for (const subKey in apiErrors[key]) {
                            const fullKey = `${key}_${subKey}`;
                            if (Array.isArray(apiErrors[key][subKey])) newErrors[fullKey] = apiErrors[key][subKey].join(", ");
                            else newErrors[fullKey] = apiErrors[key][subKey];
                        }
                    }
                }
            }
            setErrors(newErrors);
            toast.error("Save failed. Please check the form for issues.");
        }
    };

    const handleDelete = async () => {
        if (!invoice?.id) return toast.error("No invoice to delete.");
        if (!window.confirm("Delete this invoice?")) return;
        try {
            await axios.delete(`invoices/${invoice.id}/`);
            toast.success("Invoice deleted");

            setInvoiceList((prev) => prev.filter((x) => x.id !== invoice.id));
            setSelectedInvoiceId("NEW");
            setInvoice(null);
            setIsEditing(true);
            setInvoiceDate(todayISO);
            reinitItemsForSaleType(entry, saleType);
            onSaved && onSaved(entry.id);
        } catch {
            toast.error("Delete failed");
        }
    };

    const handleGenerate = async () => {
        if (!invoice?.id) return toast.error("Please save the invoice before generating the PDF.");
        try {
            const res = await axios.get(`invoices/${invoice.id}/pdf/`, {responseType: "blob"});
            const blob = new Blob([res.data], {type: "application/pdf"});
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.setAttribute("download", `${invoice.invoice_number || "invoice"}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            toast.error("Failed to download invoice PDF.");
        }
    };

    const scrollIntoView = () => {
        requestAnimationFrame(() => {
            formTopRef.current?.scrollIntoView({behavior: "smooth", block: "start"});
        });
    };

    // init
    useEffect(() => {
        (async function init() {
            if (!entry) return setLoading(false);

            // default "to" from exporter (for NEW)
            setToCompany({
                id: entry.exporter?.id,
                name: entry.exporter?.name || "",
                address_line_1: entry.exporter?.address_line_1 || "",
                address_line_2: entry.exporter?.address_line_2 || "",
                pan: entry.exporter?.pan || "",
                gst_number: entry.exporter?.gst_number || "",
            });

            const list = entry.invoices || [];
            setInvoiceList(list);
            setSelectedInvoiceId("NEW");
            setInvoice(null);
            setIsEditing(true);
            setInvoiceDate(todayISO);
            setSaleType(initialSaleType);
            setBillingMode("kg");
            setSaleBasis(fullBasis);
            setEntity(null);

            reinitItemsForSaleType(entry, initialSaleType);
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entry]);

    // switching NEW/existing
    useEffect(() => {
        if (selectedInvoiceId === "NEW") {
            setInvoice(null);
            setIsEditing(true);
            setInvoiceDate(todayISO);
            reinitItemsForSaleType(entry, saleType);
            scrollIntoView();
            return;
        }
        const inv = invoiceList.find((x) => `${x.id}` === `${selectedInvoiceId}`);
        if (!inv) return;

        const mappedItems = (inv.items || []).map((it) => ({
            ...it,
            rate: Number(it.rate || 0),
            amount: Number(it.amount || 0),
            qty: Number(it.qty || 0),
        }));

        setInvoice(inv);
        setIsEditing(false);
        setInvoiceDate(String(inv.invoice_date || "").slice(0, 10));

        const invSaleType = inv.sale_type || "item";
        setSaleType(invSaleType);
        if (invSaleType === "item") {
            setBillingMode(inv.billing_mode === "kg" ? "kg" : "cif_inr");
        } else {
            setSaleBasis(inv.billing_mode === "fob" ? "fob_inr" : "cif_inr");
        }

        setEntity(inv.from_entity ? {id: inv.from_entity} : null);
        hydrateToCompanyFromInvoice(inv);
        setItems(mappedItems);

        scrollIntoView();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedInvoiceId]);

    if (loading) return <Spinner/>;

    // ------------------------------ VIEW MODE ----------------------------------
    if (!isEditing && invoice) {
        const isFull = (invoice.sale_type || saleType) === "full";
        const viewTotals = computeTotals(invoice.items || []);
        const viewBasis = invoice?.billing_mode === "fob" ? "fob_inr" : "cif_inr";

        return (
            <div ref={formTopRef} className="p-3 bg-light rounded">
                <Row className="mb-3 align-items-end">
                    <Col md={6}>
                        <Form.Label>Invoice</Form.Label>
                        <Form.Select
                            value={selectedInvoiceId}
                            onChange={(e) => setSelectedInvoiceId(e.target.value)}
                        >
                            <option value="NEW">+ Create New Invoice</option>
                            {invoiceList.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                    #{inv.invoice_number} — {inv.to_company_name || "—"}
                                </option>
                            ))}
                        </Form.Select>
                    </Col>
                    <Col md="auto" className="text-end">
                        <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
                        <Button className="ms-2" onClick={handleGenerate}>Download PDF</Button>
                        <Button className="ms-2 btn-danger" onClick={handleDelete}>Delete</Button>
                    </Col>
                </Row>

                <Card className="mb-3">
                    <Card.Header className="fw-semibold">
                        Invoice #{invoice.invoice_number} — {invoiceDate || "—"}
                    </Card.Header>
                    <Card.Body>
                        <Row>
                            <Col md={6}>
                                <h6 className="text-muted">From Entity</h6>
                                <div>{entity?.name || (entity?.id ? `ID: ${entity.id}` : "—")}</div>
                            </Col>
                            <Col md={6}>
                                <h6 className="text-muted">To Company</h6>
                                <div>{toCompany.name || "—"}</div>
                                <div>PAN: {invoice.to_company_pan || "—"} |
                                    GST: {invoice.to_company_gst_number || "—"}</div>
                                <div>{invoice.to_company_address_line_1 || "—"}</div>
                                <div>{invoice.to_company_address_line_2 || ""}</div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                <SaleItemsTable
                    items={invoice?.items ?? []}
                    saleType={isFull ? "full" : "item"}
                    billingMode={invoice?.billing_mode === "kg" ? "kg" : "cif_inr"}
                    saleBasis={viewBasis}
                    totals={viewTotals || {qty: 0, cif_fc: 0, cif_inr: 0, fob_inr: 0, amount: 0}}
                    onRateChange={() => {
                    }}
                    onRemoveRow={() => {
                    }}
                />
            </div>
        );
    }

    // ------------------------------ EDIT / CREATE ------------------------------
    return (
        <Form ref={formTopRef} className="p-3 bg-light rounded">
            {/* Invoice selector */}
            <Row className="mb-3 align-items-end">
                <Col md={6}>
                    <Form.Label>Invoice</Form.Label>
                    <Form.Select
                        value={selectedInvoiceId}
                        onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    >
                        <option value="NEW">+ Create New Invoice</option>
                        {invoiceList.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                                #{inv.invoice_number} — {inv.to_company_name || "—"}
                            </option>
                        ))}
                    </Form.Select>
                </Col>
                <Col md="auto" className="text-end">
                    <Button variant="outline-primary" onClick={() => setSelectedInvoiceId("NEW")}>
                        New
                    </Button>
                </Col>
            </Row>

            {/* Sale Type */}
            <Form.Group className="mb-3">
                <Form.Label className="me-2">Sale Type</Form.Label>
                <Form.Check
                    inline
                    type="radio"
                    label="Item-wise"
                    checked={saleType === "item"}
                    onChange={() => {
                        setSaleType("item");
                        reinitItemsForSaleType(entry, "item", /*keepIfEditingExisting*/ true);
                    }}
                />
                <Form.Check
                    inline
                    type="radio"
                    label="Full License"
                    checked={saleType === "full"}
                    onChange={() => {
                        setSaleType("full");
                        reinitItemsForSaleType(entry, "full", /*keepIfEditingExisting*/ true);
                    }}
                />
            </Form.Group>

            {/* From entity + invoice meta */}
            <Form.Group className="mb-3">
                <Form.Label>From Company</Form.Label>
                <div className={errors.from_entity ? "border border-danger rounded p-2" : ""}>
                    <EntitySelect
                        value={entity}
                        onChange={(val) => {
                            setEntity(val);
                            setTimeout(() => setErrors(validateInvoiceForm({toCompany, entity: val, items})), 0);
                        }}
                    />
                    {errors.from_entity && <div className="text-danger small mt-1">{errors.from_entity}</div>}
                </div>

                <Row className="mt-3">
                    <Col md={6}>
                        <ValidatedInput
                            label="Invoice Number (optional)"
                            value={invoice?.invoice_number || ""}
                            onChange={(e) => setInvoice((prev) => ({...(prev || {}), invoice_number: e.target.value}))}
                            placeholder="Leave blank to auto-generate"
                            error={errors.invoice_number}
                        />
                    </Col>
                    <Col md={6}>
                        <Form.Label>Invoice Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            isInvalid={!!errors.invoice_date}
                        />
                        <Form.Control.Feedback type="invalid">{errors.invoice_date}</Form.Control.Feedback>
                    </Col>
                </Row>
            </Form.Group>

            {/* To Company — async picker + auto-fill */}
            <Form.Group className="mb-2">
                <Form.Label>To Company (search)</Form.Label>
                <AsyncCompanySelect
                    value={toCompany?.id ? {value: toCompany.id, label: toCompany.name, ...toCompany} : null}
                    onChange={(opt) => {
                        if (!opt) {
                            setToCompany({
                                id: null,
                                name: "",
                                pan: "",
                                gst_number: "",
                                address_line_1: "",
                                address_line_2: ""
                            });
                            setTimeout(() => setErrors(validateInvoiceForm({toCompany: {}, entity, items})), 0);
                            return;
                        }
                        const picked = {
                            id: opt.id ?? opt.value ?? null,
                            name: opt.name ?? opt.label ?? "",
                            pan: opt.pan ?? "",
                            gst_number: opt.gst_number ?? "",
                            address_line_1: opt.address_line_1 ?? "",
                            address_line_2: opt.address_line_2 ?? "",
                        };
                        setToCompany(picked);
                        setTimeout(() => setErrors(validateInvoiceForm({toCompany: picked, entity, items})), 0);
                    }}
                    isClearable
                    placeholder="Search company…"
                />
                {errors.to_company_name && <div className="text-danger small mt-1">{errors.to_company_name}</div>}
            </Form.Group>

            <Row className="mb-3">
                <Col md={4}>
                    <ValidatedInput
                        label="To Company"
                        value={toCompany.name || ""}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, name: val}));
                            setTimeout(() => setErrors(validateInvoiceForm({
                                toCompany: {...toCompany, name: val},
                                entity,
                                items
                            })), 0);
                        }}
                        placeholder="Enter Company Name"
                        error={errors.to_company_name}
                    />
                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="PAN"
                        value={toCompany.pan || ""}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, pan: val}));
                            setTimeout(() => setErrors(validateInvoiceForm({
                                toCompany: {...toCompany, pan: val},
                                entity,
                                items
                            })), 0);
                        }}
                        placeholder="Enter PAN Number"
                        error={errors.to_company_pan}
                    />
                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="GST"
                        value={toCompany.gst_number || ""}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, gst_number: val}));
                            setTimeout(() => setErrors(validateInvoiceForm({
                                toCompany: {...toCompany, gst_number: val},
                                entity,
                                items
                            })), 0);
                        }}
                        placeholder="Enter GST Number"
                        error={errors.to_company_gst}
                    />
                </Col>
                <Col md={6}>
                    <ValidatedInput
                        label="Address Line 1"
                        value={toCompany.address_line_1 || ""}
                        onChange={(e) => setToCompany((prev) => ({
                            ...prev,
                            address_line_1: e.target.value.toUpperCase()
                        }))}
                        placeholder="Enter Address Line 1.."
                        error={errors.address_line_1}
                    />
                </Col>
                <Col md={6}>
                    <ValidatedInput
                        label="Address Line 2"
                        value={toCompany.address_line_2 || ""}
                        onChange={(e) => setToCompany((prev) => ({
                            ...prev,
                            address_line_2: e.target.value.toUpperCase()
                        }))}
                        placeholder="Enter Address Line 2.."
                        error={errors.address_line_2}
                    />
                </Col>
            </Row>

            {/* Billing / Basis */}
            {saleType === "full" ? (
                <Form.Group className="mb-3">
                    <Form.Label>Full License Basis</Form.Label><br/>
                    <Form.Check inline type="radio" label="CIF INR" checked={saleBasis === "cif_inr"}
                                onChange={() => handleSaleBasisChange("cif_inr")}/>
                    <Form.Check inline type="radio" label="FOB INR" checked={saleBasis === "fob_inr"}
                                onChange={() => handleSaleBasisChange("fob_inr")}/>
                </Form.Group>
            ) : (
                <Form.Group className="mb-3">
                    <Form.Label>Billing Mode</Form.Label><br/>
                    <Form.Check inline type="radio" label="By KG" checked={billingMode === "kg"}
                                onChange={() => handleBillingModeChange("kg")}/>
                    <Form.Check inline type="radio" label="By CIF INR (%)" checked={billingMode === "cif_inr"}
                                onChange={() => handleBillingModeChange("cif_inr")}/>
                </Form.Group>
            )}

            <SaleItemsTable
                items={items}
                saleType={saleType}
                billingMode={billingMode}
                saleBasis={saleBasis}
                totals={totals}
                onRateChange={onRateChange}
                onFieldChange={onFieldChange}   // ← enables editing CIF/FOB (Base) in FULL mode
                onRemoveRow={onRemoveRow}
            />

            {saleType !== "full" && (
                <Button
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                        setItems((prev) => [
                            ...prev,
                            {
                                ...(prev[0] || {
                                    sr_id: entry?.import_license?.[0]?.id || null,
                                    license_no: entry?.license_number || "",
                                    qty: 0, cif_fc: 0, cif_inr: 0, fob_inr: 0,
                                }),
                                rate: 0,
                                amount: 0,
                            },
                        ])
                    }
                >
                    + Add Row
                </Button>
            )}

            <hr/>
            <div className="d-flex gap-2">
                <Button onClick={handleSave}>Save Invoice</Button>
                {invoice?.id && <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel Edit</Button>}
                {invoice?.id && <Button className="ms-auto" onClick={handleGenerate}>Download PDF</Button>}
            </div>
        </Form>
    );
}
