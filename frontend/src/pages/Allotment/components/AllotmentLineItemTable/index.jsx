import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Button, Col, Form, Modal, Row, Spinner, Table} from 'react-bootstrap';
import AsyncNormSelect from '../../../../components/AsyncNormSelect';
import axios from '../../../../api/axiosInstance';
import {toast} from 'react-toastify';
import '../../AllotmentList.css';

const LICENSE_SEARCH_URL = '/api/license-import-items/select/';
const ADD_DETAIL_URL = (id) => `/api/allotments/${id}/details/`;
const FALLBACK_DELETE_DETAIL_URL = (allotmentId, detailId) =>
    `/api/allotments/${allotmentId}/details/${detailId}/`;

const fmt = (n) => {
    const v = Number(n ?? 0);
    if (!isFinite(v)) return '-';
    return v.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};
const safeNum = (v) => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
};
const round2 = (n) => Number(safeNum(n).toFixed(2));
const roundQty = (n) => {
    const x = Math.floor(safeNum(n));
    return isFinite(x) ? x : 0;
};

const AllotmentLineItemTable = ({
                                    items,
                                    errors = {},
                                    onItemChange,
                                    onAddRow,
                                    onRemoveRow,
                                    unitPrice = 0,
                                    requiredQuantity = 0,
                                    requiredValue,
                                    defaultItemName,
                                    allotmentId,
                                    onSaved,
                                }) => {
    const price = safeNum(unitPrice);

    // Remove-all state + modal
    const [deletingAll, setDeletingAll] = useState(false);
    const [showRemoveAll, setShowRemoveAll] = useState(false);

    // ---- Current totals (top summary) ----
    const totals = useMemo(() => {
        let qty = 0, value = 0;
        (items || []).forEach((r) => {
            const q = roundQty(r.qty);
            qty += q;
            const rowVal = r.cif_fc != null && r.cif_fc !== '' ? safeNum(r.cif_fc) : q * price;
            value += rowVal;
        });
        return {qty, value: round2(value)};
    }, [items, price]);

    const reqVal = useMemo(() => {
        const explicit = safeNum(requiredValue);
        if (explicit > 0) return explicit;
        const q = roundQty(requiredQuantity);
        return round2(q * price);
    }, [requiredValue, requiredQuantity, price]);

    const balance = useMemo(
        () => ({
            qty: Math.max(0, roundQty(requiredQuantity) - totals.qty),
            value: round2(Math.max(0, reqVal - totals.value)),
        }),
        [requiredQuantity, totals, reqVal]
    );

    // ---- Filters for license search ----
    const [srFilters, setSrFilters] = useState({
        license_number: '',
        sion_norm_id: '',
        sion_norm_label: '',
        description: defaultItemName || '',
        hs_code: '',
        notification_number: '',
        expired: 'false',
        is_null: 'false',
        min_balance_cif: 500,
        min_balance_qty: 100,
    });
    const setFilter = (k, v) => setSrFilters((p) => ({...p, [k]: v}));

    // ---- Paging + results ----
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;

    // Per-result inputs
    const [inputs, setInputs] = useState({});
    const setInput = (id, field, value) => {
        setInputs((prev) => ({...prev, [id]: {...(prev[id] || {}), [field]: value}}));
    };

    const [posting, setPosting] = useState({});
    const [deleting, setDeleting] = useState({});

    const buildParams = useCallback(() => {
        const s = (v) => ((v ?? '') + '').trim();
        const p = {};
        if (s(srFilters.license_number)) p.license_number = s(srFilters.license_number);
        if (s(srFilters.sion_norm_id)) p.sion_norm_id = s(srFilters.sion_norm_id);
        if (s(srFilters.description)) p.description = s(srFilters.description);
        if (s(srFilters.hs_code)) p.hs_code = s(srFilters.hs_code);
        if (s(srFilters.notification_number)) p.notification_number = s(srFilters.notification_number);
        if (srFilters.expired !== 'any') p.expired = srFilters.expired;
        if (srFilters.is_null !== 'any') p.is_null = srFilters.is_null;
        p.min_balance_cif = Number(srFilters.min_balance_cif) || 0;
        p.min_balance_qty = Number(srFilters.min_balance_qty) || 0;
        p.page = page;
        p.page_size = pageSize;
        return p;
    }, [srFilters, page]);

    // Compute max allotable qty (integer) for a search row
    const computeMaxAllotableQty = useCallback(
        (row) => {
            if (price <= 0) return 0;

            const availQty = roundQty(row.available_quantity);
            const availVal = safeNum(row.available_value);

            const byValueQty = Number.isFinite(availVal) && availVal > 0 ? roundQty(availVal / price) : Infinity;

            const remainingValue = reqVal > 0 ? Math.max(0, reqVal - totals.value + 10) : Infinity;
            const byRemainingValueQty =
                Number.isFinite(remainingValue) && remainingValue > 0 ? roundQty(remainingValue / price) : Infinity;

            const remainingReqQty =
                roundQty(requiredQuantity) > 0 ? Math.max(0, roundQty(requiredQuantity) - totals.qty) : Infinity;

            let q = availQty;
            if (Number.isFinite(byValueQty)) q = Math.min(q, byValueQty);
            if (Number.isFinite(byRemainingValueQty)) q = Math.min(q, byRemainingValueQty);
            if (Number.isFinite(remainingReqQty)) q = Math.min(q, remainingReqQty);

            q = roundQty(q);
            return q > 0 ? q : 0;
        },
        [price, reqVal, totals.value, totals.qty, requiredQuantity]
    );

    const fetchResults = useCallback(async () => {
        setLoading(true);
        try {
            const {data} = await axios.get(LICENSE_SEARCH_URL, {params: buildParams()});
            const list = data?.results || data || [];
            setResults(Array.isArray(list) ? list : []);
            setCount(data?.count ?? list.length);

            // Prefill with max allotable qty and derived $
            const map = {};
            list.forEach((r) => {
                let qty = '';
                let cif_fc = '';
                if (price > 0) {
                    const maxQ = computeMaxAllotableQty(r);
                    if (maxQ > 0) {
                        qty = String(maxQ);
                        cif_fc = String(round2(maxQ * price));
                    }
                }
                map[r.id] = {qty, cif_fc};
            });
            setInputs(map);
        } catch {
            setResults([]);
            setCount(0);
            setInputs({});
        } finally {
            setLoading(false);
        }
    }, [buildParams, price, computeMaxAllotableQty]);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    const clearFilters = () => {
        setSrFilters({
            license_number: '',
            sion_norm_id: '',
            sion_norm_label: '',
            description: defaultItemName || '',
            hs_code: '',
            notification_number: '',
            expired: 'false',
            is_null: 'false',
            min_balance_cif: 500,
            min_balance_qty: 100,
        });
        setPage(1);
    };

    // Allot one row (POST) with confirm
    const allotRow = async (resRow) => {
        if (!allotmentId) return toast.error('Missing allotmentId to create detail.');

        const id = resRow.id;
        const inpt = inputs[id] || {};
        let qty = roundQty(inpt.qty);
        let val = safeNum(inpt.cif_fc);

        const availQty = roundQty(resRow.available_quantity);
        const availVal = safeNum(resRow.available_value);

        // Derive missing side from price
        if (price > 0) {
            if (qty > 0 && (inpt.cif_fc === '' || val === 0)) val = round2(qty * price);
            else if (val > 0 && (inpt.qty === '' || qty === 0)) qty = roundQty(val / price);
        }

        if (qty <= 0 && val <= 0) return toast.warn('Enter Allot Qty or Allot $ (or both).');

        // Cap by available $
        if (Number.isFinite(availVal) && availVal > 0) {
            if (val > 0) val = Math.min(val, availVal);
            else if (price > 0 && qty > 0) val = Math.min(round2(qty * price), availVal);
        }

        // Cap by value => recalc qty (floor)
        if (price > 0) {
            const qtyFromVal = round2(val / price);
            qty = qty > 0 ? Math.min(qty, qtyFromVal) : qtyFromVal;
        }

        // Cap by available qty (integers)
        if (Number.isFinite(availQty) && availQty > 0 && qty > availQty) {
            qty = availQty;
            if (price > 0) val = round2(qty * price);
            if (Number.isFinite(availVal) && availVal > 0) val = Math.min(val, availVal);
        }

        // Budget cap only if license CAN'T fully cover the request
        const hasAvailQty = Number.isFinite(availQty);
        const hasAvailVal = Number.isFinite(availVal);
        const licenseCoversRequest = (hasAvailQty && availQty >= qty) && (hasAvailVal && availVal >= val);

        if (!licenseCoversRequest) {
            const remainingValue = reqVal > 0 ? Math.max(0, reqVal - totals.value) : Infinity;
            if (Number.isFinite(remainingValue) && val > remainingValue) {
                val = remainingValue;
                if (price > 0) qty = roundQty(val / price);
            }
        }

        const remainingReqQty =
            roundQty(requiredQuantity) > 0 ? Math.max(0, roundQty(requiredQuantity) - totals.qty) : Infinity;
        if (Number.isFinite(remainingReqQty) && qty > remainingReqQty) {
            qty = remainingReqQty;
            if (price > 0) val = round2(qty * price);
        }

        qty = roundQty(qty);
        val = round2(val);

        if (qty <= 0 || val <= 0) return toast.warn('Allotment after constraints is zero.');
        
        try {
            setPosting((p) => ({...p, [id]: true}));
            await axios.post(ADD_DETAIL_URL(allotmentId), {
                item_id: resRow.id,
                qty,
                cif_fc: val,
                cif_inr: 0,
                is_boe: false,
            });
            toast.success('Allotted successfully');
            setInputs((prev) => ({...prev, [id]: {qty: '', cif_fc: ''}}));
            onSaved?.();
            fetchResults(); // refresh availability
        } catch (e) {
            const apiErrors = e.response?.data;
            if (apiErrors && typeof apiErrors === 'object') {
                const first = Object.values(apiErrors)[0];
                toast.error(Array.isArray(first) ? first.join(', ') : String(first));
            } else {
                toast.error('Failed to allot. Please try again.');
            }
        } finally {
            setPosting((p) => ({...p, [id]: false}));
        }
    };

    // Totals for the top table footer
    const tableTotals = useMemo(() => {
        let qty = 0;
        let cif = 0;
        (items || []).forEach((r) => {
            qty += roundQty(r.qty);
            cif += safeNum(r.cif_fc);
        });
        return {qty, cif: round2(cif)};
    }, [items]);

    // Delete one existing detail
    const removeDetail = async (row, index) => {
        if (!row?.id) {
            onRemoveRow?.(index);
            return;
        }
        const detailId = row.id;
        const url = row.delete_url || (allotmentId ? FALLBACK_DELETE_DETAIL_URL(allotmentId, detailId) : null);
        if (!url) return toast.error('Delete URL not available.');

        try {
            setDeleting((d) => ({...d, [detailId]: true}));
            await axios.delete(url);
            toast.success('Allotment line removed');
            onRemoveRow?.(index);
            onSaved?.();
            fetchResults();
        } catch (e) {
            const apiErrors = e.response?.data;
            if (apiErrors && typeof apiErrors === 'object') {
                const first = Object.values(apiErrors)[0];
                toast.error(Array.isArray(first) ? first.join(', ') : String(first));
            } else {
                toast.error('Failed to remove line. Please try again.');
            }
        } finally {
            setDeleting((d) => ({...d, [detailId]: false}));
        }
    };

    // Bulk remove all details (invoked from modal)
    const actuallyRemoveAllDetails = async () => {
        const rows = items || [];
        if (rows.length === 0) return;

        setDeletingAll(true);
        try {
            const saved = rows.map((row, idx) => ({row, idx})).filter(({row}) => !!row?.id);
            const unsavedIdx = rows
                .map((row, idx) => (!row?.id ? idx : null))
                .filter((v) => v !== null)
                .sort((a, b) => b - a);

            const requests = saved.map(({row}) => {
                const url = row.delete_url || (allotmentId ? FALLBACK_DELETE_DETAIL_URL(allotmentId, row.id) : null);
                if (!url) return Promise.resolve({skipped: true});
                return axios.delete(url);
            });

            await Promise.allSettled(requests);

            unsavedIdx.forEach((idx) => onRemoveRow?.(idx));
            setShowRemoveAll(false);

            toast.success('Removed all allotted lines.');
            onSaved?.();
            fetchResults();
        } catch {
            toast.error('Failed to remove all lines. Some items may remain.');
        } finally {
            setDeletingAll(false);
        }
    };

    // Derived totals for modal
    const removeAllMeta = useMemo(() => {
        const count = (items || []).length;
        const qty = (items || []).reduce((s, r) => s + roundQty(r.qty), 0);
        const val = (items || []).reduce((s, r) => s + safeNum(r.cif_fc), 0);
        return {count, qty, val: round2(val)};
    }, [items]);

    return (
        <>
            {/* Summary */}
            <div className="border rounded p-2 mb-2 bg-light">
                <Row className="g-2 tnum">
                    <Col md="auto" className="small"><strong>Required Qty:</strong> {roundQty(requiredQuantity)}</Col>
                    <Col md="auto" className="small"><strong>Allotted Qty:</strong> {totals.qty}</Col>
                    <Col md="auto" className="small"><strong>Balance Qty:</strong> {balance.qty}</Col>
                    <Col md="auto" className="small"><strong>Unit Price ($/unit):</strong> {fmt(unitPrice)}</Col>
                    <Col md="auto" className="small"><strong>Required $:</strong> ${fmt(reqVal)}</Col>
                    <Col md="auto" className="small"><strong>Allotted $:</strong> ${fmt(totals.value)}</Col>
                    <Col md="auto" className="small"><strong>Balance $:</strong> ${fmt(balance.value)}</Col>
                </Row>
            </div>

            {/* Table 1: Current / Previously Allotted */}
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Allotted Items</h6>
                <Button
                    size="sm"
                    variant="outline-danger"
                    aria-label="Remove all allotted lines"
                    disabled={deletingAll || (items || []).length === 0}
                    onClick={() => setShowRemoveAll(true)}
                >
                    Remove All
                </Button>
            </div>

            <div className="table-scroll">
                <Table size="sm" bordered responsive className="mb-3">
                    <thead className="table-light">
                    <tr>
                        <th style={{width: 40}}>#</th>
                        <th>License Item (SR)</th>
                        <th className="text-end" style={{width: 120}}>Qty</th>
                        <th className="text-end" style={{width: 140}}>CIF $</th>
                        <th style={{width: 110}}/>
                    </tr>
                    </thead>
                    <tbody className="tnum">
                    {(items || []).length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center text-muted">No items allotted yet</td>
                        </tr>
                    )}
                    {(items || []).map((row, i) => {
                        const isDel = row?.id ? !!deleting[row.id] : false;
                        return (
                            <tr key={row.id || i}>
                                <td>{i + 1}</td>
                                <td>{row.sr_number?.label || '-'}</td>
                                <td className="text-end">{Number(roundQty(row.qty ?? 0)).toLocaleString('en-IN')}</td>
                                <td className="text-end">{fmt(row.cif_fc)}</td>
                                <td className="text-end">
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        aria-label={`Remove line ${row?.sr_number?.label || ''}`}
                                        disabled={isDel}
                                        onClick={() => removeDetail(row, i)}
                                    >
                                        {isDel ? (<><Spinner size="sm" className="me-1"/> Removing…</>) : 'Remove'}
                                    </Button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                    <tfoot className="tnum">
                    <tr className="table-light fw-semibold">
                        <td colSpan={2} className="text-end">Total</td>
                        <td className="text-end">{tableTotals.qty}</td>
                        <td className="text-end">{fmt(tableTotals.cif)}</td>
                        <td/>
                    </tr>
                    </tfoot>
                </Table>
            </div>

            {/* Filters */}
            <h6 className="mb-2">License Items Search</h6>
            <div className="border rounded p-2 mb-2 bg-light">
                <Row className="g-2 align-items-end">
                    <Col md={2}>
                        <Form.Label className="small mb-1">License No</Form.Label>
                        <Form.Control size="sm" value={srFilters.license_number}
                                      onChange={(e) => setFilter('license_number', e.target.value)}/>
                    </Col>
                    <Col md={3}>
                        <Form.Label className="small mb-1">SION Norm</Form.Label>
                        <AsyncNormSelect
                            value={srFilters.sion_norm_id ? {
                                id: srFilters.sion_norm_id,
                                label: srFilters.sion_norm_label
                            } : null}
                            onChange={(opt) => {
                                setFilter('sion_norm_id', opt?.id || opt?.value || '');
                                setFilter('sion_norm_label', opt?.label || opt?.norm_class || '');
                            }}
                            placeholder="Search SION norm…"
                        />
                    </Col>
                    <Col md={3}>
                        <Form.Label className="small mb-1">Description</Form.Label>
                        <Form.Control size="sm" value={srFilters.description}
                                      onChange={(e) => setFilter('description', e.target.value)}/>
                    </Col>
                    <Col md={2}>
                        <Form.Label className="small mb-1">HSN Code</Form.Label>
                        <Form.Control size="sm" value={srFilters.hs_code}
                                      onChange={(e) => setFilter('hs_code', e.target.value)}/>
                    </Col>
                    <Col md={2}>
                        <Form.Label className="small mb-1">Notification No</Form.Label>
                        <Form.Control size="sm" value={srFilters.notification_number}
                                      onChange={(e) => setFilter('notification_number', e.target.value)}/>
                    </Col>
                    <Col md={1}>
                        <Form.Label className="small mb-1">Expired</Form.Label>
                        <Form.Select size="sm" value={srFilters.expired}
                                     onChange={(e) => setFilter('expired', e.target.value)}>
                            <option value="any">Any</option>
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                        </Form.Select>
                    </Col>
                    <Col md={1}>
                        <Form.Label className="small mb-1">Is Null</Form.Label>
                        <Form.Select size="sm" value={srFilters.is_null}
                                     onChange={(e) => setFilter('is_null', e.target.value)}>
                            <option value="any">Any</option>
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                        </Form.Select>
                    </Col>
                    <Col md={2}>
                        <Form.Label className="small mb-1">Min Balance Qty</Form.Label>
                        <Form.Control size="sm" type="number" min="0" value={srFilters.min_balance_qty}
                                      onChange={(e) => setFilter('min_balance_qty', e.target.value)}/>
                    </Col>
                    <Col md={2}>
                        <Form.Label className="small mb-1">Min Balance CIF ($)</Form.Label>
                        <Form.Control size="sm" type="number" min="0" value={srFilters.min_balance_cif}
                                      onChange={(e) => setFilter('min_balance_cif', e.target.value)}/>
                    </Col>
                    <Col md="auto" className="pt-3">
                        <Button size="sm" onClick={() => {
                            setPage(1);
                            fetchResults();
                        }}>
                            {loading ? (<><Spinner size="sm"/> Searching…</>) : 'Search'}
                        </Button>
                        <Button size="sm" variant="outline-secondary" className="ms-2"
                                onClick={clearFilters}>Clear</Button>
                    </Col>
                    <Col className="small text-muted pt-3">
                        {count ? `Showing ${results.length} of ${count}` : (loading ? '' : 'No results')}
                    </Col>
                    <Col md="auto" className="pt-3">
                        <div className="d-flex gap-2">
                            <Button size="sm" variant="outline-primary" disabled={page <= 1 || loading}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}>◀ Prev</Button>
                            <Button size="sm" variant="outline-primary" disabled={results.length < pageSize || loading}
                                    onClick={() => setPage((p) => p + 1)}>Next ▶</Button>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Table 2: Search results with per-row allot inputs */}
            <div className="table-scroll">
                <Table size="sm" bordered responsive className="mb-2">
                    <thead className="table-light">
                    <tr>
                        <th style={{width: 40}}>#</th>
                        <th>License / SR</th>
                        <th style={{width: 110}} className="text-end">HSN</th>
                        <th className="text-start">Description</th>
                        <th className="text-start">Notification No</th>
                        <th style={{width: 130}} className="text-end">Available Qty</th>
                        <th style={{width: 130}} className="text-end">Available $</th>
                        <th style={{width: 160}} className="text-end">Allot Qty</th>
                        <th style={{width: 160}} className="text-end">Allot $</th>
                        <th style={{width: 120}}/>
                    </tr>
                    </thead>
                    <tbody className="tnum">
                    {results.length === 0 && !loading && (
                        <tr>
                            <td colSpan={10} className="text-center text-muted">No license items match your filters</td>
                        </tr>
                    )}
                    {results.map((r, idx) => {
                        const inpt = inputs[r.id] || {qty: '', cif_fc: ''};
                        const availVal = safeNum(r.available_value);
                        const availQty = roundQty(r.available_quantity);

                        const onEnterAllot = (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                allotRow(r);
                            }
                        };

                        return (
                            <tr key={r.id}>
                                <td>{(page - 1) * pageSize + idx + 1}</td>
                                <td>{r.display_name}</td>
                                <td className="text-end">{r.hs_code}</td>
                                <td className="text-start">{r.description}</td>
                                <td className="text-start">{r.notification_number || '-'}</td>
                                <td className="text-end">{availQty}</td>
                                <td className="text-end">{fmt(r.available_value)}</td>

                                {/* Allot Qty (integer) + Max chip */}
                                <td>
                                    <div className="input-with-chip">
                                        <Form.Control
                                            size="sm"
                                            className="text-end"
                                            value={inpt.qty ?? ''}
                                            onKeyDown={onEnterAllot}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                setInput(r.id, 'qty', raw);
                                                if (price <= 0) return;

                                                const typedQty = roundQty(raw);

                                                const maxByVal =
                                                    Number.isFinite(availVal) && availVal > 0 && price > 0 ? roundQty(availVal / price) : Infinity;
                                                const maxByQty = Number.isFinite(availQty) && availQty > 0 ? availQty : Infinity;

                                                let finalQty = typedQty;
                                                if (Number.isFinite(maxByVal)) finalQty = Math.min(finalQty, maxByVal);
                                                if (Number.isFinite(maxByQty)) finalQty = Math.min(finalQty, maxByQty);

                                                setInput(r.id, 'qty', String(finalQty));
                                                setInput(r.id, 'cif_fc', String(round2(finalQty * price)));
                                            }}
                                            aria-label={`Allot quantity for ${r.display_name}`}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline-secondary"
                                            onClick={() => {
                                                const maxQ = computeMaxAllotableQty(r);
                                                setInput(r.id, 'qty', String(maxQ));
                                                setInput(r.id, 'cif_fc', String(round2(maxQ * price)));
                                            }}
                                            aria-label={`Use maximum quantity for ${r.display_name}`}
                                        >
                                            Max
                                        </Button>
                                    </div>
                                </td>

                                {/* Allot $ (derived if unit price known) */}
                                <td>
                                    <Form.Control
                                        size="sm"
                                        className="text-end"
                                        value={price > 0 ? String(round2(roundQty(inpt.qty) * price)) : (inpt.cif_fc ?? '')}
                                        readOnly={price > 0}
                                        onKeyDown={onEnterAllot}
                                        onChange={(e) => {
                                            if (price > 0) return;
                                            setInput(r.id, 'cif_fc', e.target.value);
                                        }}
                                        aria-label={`Allot amount (USD) for ${r.display_name}`}
                                    />
                                </td>

                                <td className="text-end">
                                    <Button
                                        size="sm"
                                        variant="success"
                                        disabled={!!posting[r.id]}
                                        onClick={() => allotRow(r)}
                                        aria-label={`Allot for ${r.display_name}`}
                                    >
                                        {posting[r.id] ? (<><Spinner size="sm"
                                                                     className="me-1"/> Allotting…</>) : 'Allot'}
                                    </Button>
                                </td>
                            </tr>
                        );
                    })}
                    {loading && (
                        <tr>
                            <td colSpan={10} className="text-center text-muted"><Spinner size="sm"/> Loading…</td>
                        </tr>
                    )}
                    </tbody>
                </Table>
            </div>

            {/* Remove All modal */}
            <Modal show={showRemoveAll} onHide={() => setShowRemoveAll(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Remove all allotted lines?</Modal.Title>
                </Modal.Header>
                <Modal.Body className="tnum">
                    <div className="mb-2">This will remove <strong>{removeAllMeta.count}</strong> line(s).</div>
                    <div className="mb-1"><strong>Total Qty:</strong> {removeAllMeta.qty}</div>
                    <div><strong>Total $:</strong> ${fmt(removeAllMeta.val)}</div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRemoveAll(false)}>Cancel</Button>
                    <Button
                        variant="danger"
                        onClick={actuallyRemoveAllDetails}
                        disabled={deletingAll}
                        aria-label="Confirm remove all allotted lines"
                    >
                        {deletingAll ? (<><Spinner size="sm" className="me-1"/> Removing…</>) : 'Remove All'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default AllotmentLineItemTable;
