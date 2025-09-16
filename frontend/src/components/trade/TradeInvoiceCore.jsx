// src/pages/Trade/TradeInvoiceCore.jsx
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Button, Col, Form, Row, Spinner, Table} from 'react-bootstrap';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';
import ValidatedInput from '../../components/ValidatedInput';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect';
import AsyncSrNumberSelect from '../../components/AsyncSelect/AsyncSrNumberSelect';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z{1}[0-9A-Z]{1}$/;
const HSN_DEFAULT = '47090000';

const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};
const newRid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function computeTotals(arr) {
    const base = (arr || []).reduce(
        (acc, it) => ({
            qty: acc.qty + toNum(it?.qty),
            cif_fc: acc.cif_fc + toNum(it?.cif_fc),
            cif_inr: acc.cif_inr + toNum(it?.cif_inr),
            fob_inr: acc.fob_inr + toNum(it?.fob_inr),
            amount: acc.amount + toNum(it?.amount),
        }),
        {qty: 0, cif_fc: 0, cif_inr: 0, fob_inr: 0, amount: 0}
    );
    return {
        qty: +base.qty.toFixed(2),
        cif_fc: +base.cif_fc.toFixed(2),
        cif_inr: +base.cif_inr.toFixed(2),
        fob_inr: +base.fob_inr.toFixed(2),
        amount: +base.amount.toFixed(2),
    };
}

function inferBillingModeFromLines(lines = []) {
    const hasFOB = (lines || []).some((ln) => ln.mode === 'FOB_INR');
    if (hasFOB) return 'fob_inr';
    const hasCIF = (lines || []).some((ln) => ln.mode === 'CIF_INR');
    return hasCIF ? 'cif_inr' : 'kg';
}

const srOptionFromRow = (row) =>
    row?.sr_id
        ? {
            value: row.sr_id,
            id: row.sr_id,
            label: row.sr_label || row.license_no || `SR #${row.sr_id}`,
            data: {display_name: row.sr_label || row.license_no},
        }
        : null;

const TradeInvoiceCore = ({
                              mode = 'SALE',       // "SALE" | "PURCHASE"
                              boe = null,          // optional BOE for seeding (SALE)
                              initialTrade = null, // optional existing trade
                              fetchByBoe = true,   // for SALE+boe trade selector
                              onSaved,
                          }) => {
    const [loading, setLoading] = useState(true);

    // SALE selector (existing trades for this BOE)
    const [tradeList, setTradeList] = useState([]);
    const [selectedTradeId, setSelectedTradeId] = useState('NEW');

    // parties
    const [seller, setSeller] = useState(null); // from_company
    const [buyer, setBuyer] = useState(null);   // to_company

    // snapshots (free text)
    const [fromSnap, setFromSnap] = useState({pan: '', gst_number: '', address_line_1: '', address_line_2: ''});
    const [toSnap, setToSnap] = useState({pan: '', gst_number: '', address_line_1: '', address_line_2: '', name: ''});

    // header / items
    const [billingMode, setBillingMode] = useState('kg'); // 'kg' | 'cif_inr' | 'fob_inr'
    const [items, setItems] = useState([]);
    const [trade, setTrade] = useState(null);
    const [invoiceDate, setInvoiceDate] = useState('');   // yyyy-mm-dd
    const [isEditing, setIsEditing] = useState(true);
    const [errors, setErrors] = useState({});

    const boePrefillRunRef = useRef(false);

    const dataForTotals = useMemo(
        () => (trade && !isEditing ? trade.items : items) || [],
        [trade, isEditing, items]
    );
    const totals = computeTotals(dataForTotals);

    // ---- helpers: company snapshot ----
    const fetchCompany = async (id) => {
        if (!id) return null;
        try {
            const {data} = await axios.get(`/companies/${id}/`);
            return data || null;
        } catch {
            return null;
        }
    };
    const applyToBuyerFromObj = (obj) => {
        if (!obj) return;
        setBuyer({id: obj.id, name: obj.name || ''});
        setToSnap((prev) => ({
            ...prev,
            name: obj.name || prev.name || '',
            pan: (obj.pan || prev.pan || '').toUpperCase(),
            gst_number: (obj.gst_number || prev.gst_number || '').toUpperCase(),
            address_line_1: obj.address_line_1 ?? prev.address_line_1 ?? '',
            address_line_2: obj.address_line_2 ?? prev.address_line_2 ?? '',
        }));
    };
    const applyToSellerFromObj = (obj) => {
        if (!obj) return;
        setSeller({id: obj.id, name: obj.name || ''});
        setFromSnap((prev) => ({
            ...prev,
            pan: (obj.pan || prev.pan || '').toUpperCase(),
            gst_number: (obj.gst_number || prev.gst_number || '').toUpperCase(),
            address_line_1: obj.address_line_1 ?? prev.address_line_1 ?? '',
            address_line_2: obj.address_line_2 ?? prev.address_line_2 ?? '',
        }));
    };

    // ---- BOE prefill ----
    const prefillFromBOE = () => {
        if (!(mode === 'SALE' && boe?.item_details?.length)) return;
        const defaults = (boe.item_details || []).map((d, i) => ({
            _rid: newRid(),
            sr_id: d?.sr_number?.id ?? null,
            sr_label: d?.sr_number?.display_name || '',
            license_no: (d?.sr_number?.display_name || '').split('-')[0].replace(/^0+/, ''),
            hsn_code: HSN_DEFAULT,
            qty: String(d?.qty ?? ''),
            cif_fc: String(d?.cif_fc ?? ''),
            exchange_rate: String(boe?.exchange_rate ?? ''),
            cif_inr: String(d?.cif_inr ?? ''),
            fob_inr: '',
            rate: '',
            amount: '0',
        }));
        setItems(defaults);
    };

    // ---- init ----
    useEffect(() => {
        (async function init() {
            try {
                if (mode === 'SALE' && boe?.company) applyToBuyerFromObj(boe.company);

                if (mode === 'SALE' && boe?.item_details?.length) {
                    prefillFromBOE();
                    boePrefillRunRef.current = true;
                }

                if (mode === 'SALE' && fetchByBoe && boe?.id) {
                    try {
                        const {data} = await axios.get('/trades/', {
                            params: {direction: 'SALE', boe: boe.id, ordering: '-invoice_date,-id'},
                        });
                        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
                        const mapped = list.map((t) => ({
                            id: t.id,
                            invoice_number: t.invoice_number,
                            invoice_date: t.invoice_date,
                            to_company_name: t?.to_company?.name || '',
                            to_company_pan: t.to_pan || '',
                            to_company_gst_number: t.to_gst || '',
                            to_company_address_line_1: t.to_addr_line_1 || '',
                            to_company_address_line_2: t.to_addr_line_2 || '',
                            billing_mode: inferBillingModeFromLines(t.lines),
                            from_company_id: t.from_company?.id || null,
                            items: (t.lines || []).map((ln) => {
                                if (ln.mode === 'QTY') {
                                    const rate = toNum(ln.rate_inr_per_kg);
                                    const qty = toNum(ln.qty_kg);
                                    return {
                                        _rid: newRid(),
                                        license_no: ln?.sr_number?.license_no || ln?.sr_number?.display_name || '',
                                        sr_id: ln?.sr_number?.id,
                                        sr_label: ln?.sr_number?.display_name || '',
                                        hsn_code: ln?.description || HSN_DEFAULT,
                                        qty: String(qty),
                                        cif_fc: '',
                                        exchange_rate: '',
                                        cif_inr: '',
                                        fob_inr: '',
                                        rate: String(rate),
                                        amount: String((qty * rate).toFixed(2)),
                                    };
                                }
                                if (ln.mode === 'FOB_INR') {
                                    const pct = toNum(ln.pct);
                                    const fob = toNum(ln.fob_inr);
                                    return {
                                        _rid: newRid(),
                                        license_no: ln?.sr_number?.license_no || ln?.sr_number?.display_name || '',
                                        sr_id: ln?.sr_number?.id,
                                        sr_label: ln?.sr_number?.display_name || '',
                                        hsn_code: ln?.description || HSN_DEFAULT,
                                        qty: '',
                                        cif_fc: '',
                                        exchange_rate: '',
                                        cif_inr: '',
                                        fob_inr: String(fob),
                                        rate: String(pct),
                                        amount: String(((fob * pct) / 100).toFixed(2)),
                                    };
                                }
                                const pct = toNum(ln.pct);
                                const cif = toNum(ln.cif_inr);
                                return {
                                    _rid: newRid(),
                                    license_no: ln?.sr_number?.license_no || ln?.sr_number?.display_name || '',
                                    sr_id: ln?.sr_number?.id,
                                    sr_label: ln?.sr_number?.display_name || '',
                                    hsn_code: ln?.description || HSN_DEFAULT,
                                    qty: '',
                                    cif_fc: '',
                                    exchange_rate: '',
                                    cif_inr: String(cif),
                                    fob_inr: '',
                                    rate: String(pct),
                                    amount: String(((cif * pct) / 100).toFixed(2)),
                                };
                            }),
                        }));
                        setTradeList(mapped);
                        if (mapped.length) setSelectedTradeId(String(mapped[0].id));
                    } catch { /* ignore */
                    }
                }

                if (initialTrade?.id) {
                    setTrade(initialTrade);
                    setIsEditing(false);
                    setBillingMode(
                        initialTrade.billing_mode === 'kg'
                            ? 'kg'
                            : initialTrade.billing_mode === 'fob_inr'
                                ? 'fob_inr'
                                : 'cif_inr'
                    );
                    setInvoiceDate(String(initialTrade.invoice_date || '').slice(0, 10));

                    if (initialTrade.from_company_id || initialTrade.from_company) {
                        const id = initialTrade.from_company_id || initialTrade.from_company.id;
                        setSeller({id, name: initialTrade.from_company?.name});
                    }
                    if (initialTrade.to_company_id || initialTrade.to_company) {
                        const id = initialTrade.to_company_id || initialTrade.to_company.id;
                        setBuyer({id, name: initialTrade.to_company?.name});
                    }

                    setFromSnap({
                        pan: (initialTrade.from_pan || '').toUpperCase(),
                        gst_number: (initialTrade.from_gst || '').toUpperCase(),
                        address_line_1: initialTrade.from_addr_line_1 || '',
                        address_line_2: initialTrade.from_addr_line_2 || '',
                    });
                    setToSnap({
                        name: initialTrade.to_company?.name || '',
                        pan: (initialTrade.to_pan || '').toUpperCase(),
                        gst_number: (initialTrade.to_gst || '').toUpperCase(),
                        address_line_1: initialTrade.to_addr_line_1 || '',
                        address_line_2: initialTrade.to_addr_line_2 || '',
                    });

                    const mappedItems = (initialTrade.items || []).map((it) => ({
                        _rid: newRid(),
                        ...it,
                        qty: it.qty != null ? String(it.qty) : '',
                        cif_fc: it.cif_fc != null ? String(it.cif_fc) : '',
                        exchange_rate: it.exchange_rate != null ? String(it.exchange_rate) : '',
                        cif_inr: it.cif_inr != null ? String(it.cif_inr) : '',
                        fob_inr: it.fob_inr != null ? String(it.fob_inr) : '',
                        rate: it.rate != null ? String(it.rate) : '',
                        amount: it.amount != null ? String(it.amount) : '0',
                    }));
                    setItems(mappedItems);
                    setSelectedTradeId(String(initialTrade.id));
                } else if (!(mode === 'SALE' && fetchByBoe && boe?.id)) {
                    setSelectedTradeId('NEW');
                    setIsEditing(true);
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [mode, boe, fetchByBoe, initialTrade]);

    // BOE prefill second chance
    useEffect(() => {
        if (mode !== 'SALE' || !boe?.item_details?.length) return;
        if ((items?.length || 0) === 0 && !boePrefillRunRef.current) {
            prefillFromBOE();
            boePrefillRunRef.current = true;
        }
    }, [mode, boe, items]);

    // switch selected trade
    useEffect(() => {
        if (selectedTradeId === 'NEW') {
            setTrade(null);
            setIsEditing(true);
            setInvoiceDate('');
            setBillingMode('kg');
            return;
        }
        const inv = tradeList.find((x) => String(x.id) === String(selectedTradeId));
        if (!inv) return;
        const mappedItems = (inv.items || []).map((it) => ({
            _rid: it._rid || newRid(),
            ...it,
            qty: it.qty ?? '',
            cif_fc: it.cif_fc ?? '',
            exchange_rate: it.exchange_rate ?? '',
            cif_inr: it.cif_inr ?? '',
            fob_inr: it.fob_inr ?? '',
            rate: it.rate ?? '',
            amount: it.amount ?? '0',
        }));
        setTrade({...inv, items: mappedItems});
        setIsEditing(false);
        setInvoiceDate(String(inv.invoice_date || '').slice(0, 10));
        setBillingMode(inv.billing_mode === 'kg' ? 'kg' : inv.billing_mode === 'fob_inr' ? 'fob_inr' : 'cif_inr');
        setSeller(inv.from_company_id ? {id: inv.from_company_id} : null);
        setToSnap((prev) => ({
            ...prev,
            name: inv.to_company_name || prev.name || '',
            pan: inv.to_company_pan || prev.pan || '',
            gst_number: inv.to_company_gst_number || prev.gst_number || '',
            address_line_1: inv.to_company_address_line_1 || prev.address_line_1 || '',
            address_line_2: inv.to_company_address_line_2 || prev.address_line_2 || '',
        }));
        setItems(mappedItems);
    }, [selectedTradeId, tradeList]);

    // ---- line editing (stable keys; no focus loss) ----
    const recalcRowAmount = (row) => {
        const r = toNum(row.rate);
        if (billingMode === 'kg') return (toNum(row.qty) * r).toFixed(2);
        if (billingMode === 'cif_inr') return ((toNum(row.cif_inr) * r) / 100).toFixed(2);
        return ((toNum(row.fob_inr) * r) / 100).toFixed(2);
    };
    const updateRowField = (rid, field, value) => {
        setItems((prev) =>
            prev.map((row) => {
                if (row._rid !== rid) return row;
                const next = {...row, [field]: value}; // keep as string
                // helper autofill for CIF INR based on CIF $ * Exch Rate if empty
                if (billingMode === 'cif_inr' && (field === 'cif_fc' || field === 'exchange_rate') && !next.cif_inr) {
                    const cf = toNum(next.cif_fc);
                    const er = toNum(next.exchange_rate || boe?.exchange_rate);
                    if (cf && er) next.cif_inr = String((cf * er).toFixed(2));
                }
                next.amount = recalcRowAmount(next);
                return next;
            })
        );
    };
    const handleSrChange = (rid, option) => {
        const opt = option || null;
        const payload = opt?.data || {};
        setItems((prev) =>
            prev.map((row) => {
                if (row._rid !== rid) return row;
                const balanceCifUsd =
                    payload.balance_cif_fc ??
                    payload.cif_fc_balance ??
                    payload.balance_cif_usd ??
                    payload.license_cif_fc_total ??
                    null;
                const totalFobInr =
                    payload.balance_fob_inr ??
                    payload.fob_inr_balance ??
                    payload.total_fob_inr ??
                    payload.license_fob_inr_total ??
                    null;

                const display = payload.display_name || row.license_no || '';
                const licShort = (display.split('-')[0] || '').replace(/^0+/, '');

                const next = {
                    ...row,
                    sr_id: opt?.value || opt?.id || null,
                    sr_label: opt?.data?.display_name || opt?.label || '',
                    license_no: licShort || row.license_no || '',
                };

                if (billingMode === 'cif_inr' && !next.cif_inr) {
                    const cf = row.cif_fc || (balanceCifUsd != null ? String(balanceCifUsd) : '');
                    const er = row.exchange_rate || (boe?.exchange_rate ? String(boe.exchange_rate) : '');
                    next.cif_fc = cf;
                    next.exchange_rate = er;
                    if (toNum(cf) && toNum(er)) next.cif_inr = String((toNum(cf) * toNum(er)).toFixed(2));
                }
                if (billingMode === 'fob_inr' && !row.fob_inr && totalFobInr != null) {
                    next.fob_inr = String(totalFobInr);
                }

                next.amount = recalcRowAmount(next);
                return next;
            })
        );
    };
    const removeItem = (rid) => setItems((prev) => prev.filter((r) => r._rid !== rid));

    const handleBillingModeChange = (modeVal) => {
        setBillingMode(modeVal);
        setItems((prev) => prev.map((it) => ({...it, amount: recalcRowAmount(it)})));
    };

    // ---- validate (ONLY on save) ----
    const validate = () => {
        const newErrors = {};
        if (!seller?.id) newErrors.from_company_id = 'From Company is required.';
        if (mode === 'SALE' && !buyer?.id) newErrors.to_company_id = 'To Company is required for sales.';

        if (mode === 'SALE' && buyer?.id) {
            const pan = (toSnap.pan || '').trim().toUpperCase();
            const gst = (toSnap.gst_number || '').trim().toUpperCase();
            if (!pan) newErrors.to_company_pan = 'PAN number is required.';
            else if (!PAN_REGEX.test(pan)) newErrors.to_company_pan = 'Invalid PAN format.';
            if (!gst) newErrors.to_company_gst = 'GST number is required.';
            else if (!GST_REGEX.test(gst)) newErrors.to_company_gst = 'Invalid GST format.';
        }

        (items || []).forEach((it, idx) => {
            if (!it?.sr_id) newErrors[`item_${idx}_sr`] = 'License SR is required.';
            if (billingMode === 'kg' && toNum(it.qty) === 0) newErrors[`item_${idx}_qty`] = 'Qty is required.';
            if (billingMode === 'cif_inr' && toNum(it.cif_inr) === 0) newErrors[`item_${idx}_inr`] = 'CIF (INR) is required.';
            if (billingMode === 'fob_inr' && toNum(it.fob_inr) === 0) newErrors[`item_${idx}_fob`] = 'FOB (INR) is required.';
            if (toNum(it.rate) === 0) newErrors[`item_${idx}_rate`] = 'Valid rate is required.';
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ---- payload ----
    const buildTradePayload = () => {
        const lines = (items || []).map((it) => {
            if (billingMode === 'kg') {
                return {
                    sr_number: it.sr_id,
                    description: it.hsn_code || HSN_DEFAULT,
                    mode: 'QTY',
                    qty_kg: toNum(it.qty),
                    rate_inr_per_kg: toNum(it.rate),
                    cif_inr: 0,
                    fob_inr: 0,
                    pct: 0,
                };
            }
            if (billingMode === 'fob_inr') {
                return {
                    sr_number: it.sr_id,
                    description: it.hsn_code || HSN_DEFAULT,
                    mode: 'FOB_INR',
                    qty_kg: 0,
                    rate_inr_per_kg: 0,
                    cif_inr: 0,
                    fob_inr: toNum(it.fob_inr),
                    pct: toNum(it.rate),
                };
            }
            const cifInr =
                it.cif_inr && toNum(it.cif_inr) > 0
                    ? toNum(it.cif_inr)
                    : toNum(it.cif_fc) * (toNum(it.exchange_rate || boe?.exchange_rate));
            return {
                sr_number: it.sr_id,
                description: it.hsn_code || HSN_DEFAULT,
                mode: 'CIF_INR',
                qty_kg: 0,
                rate_inr_per_kg: 0,
                cif_inr: toNum(cifInr),
                fob_inr: 0,
                pct: toNum(it.rate),
            };
        });

        return {
            direction: mode,
            from_company_id: seller?.id || null,
            to_company_id: buyer?.id || null,
            invoice_number: trade?.invoice_number || '',
            invoice_date: invoiceDate || null,
            remarks: trade?.remarks || '',
            from_pan: (fromSnap.pan || '').toUpperCase(),
            from_gst: (fromSnap.gst_number || '').toUpperCase(),
            from_addr_line_1: fromSnap.address_line_1 || '',
            from_addr_line_2: fromSnap.address_line_2 || '',
            to_pan: (toSnap.pan || '').toUpperCase(),
            to_gst: (toSnap.gst_number || '').toUpperCase(),
            to_addr_line_1: toSnap.address_line_1 || '',
            to_addr_line_2: toSnap.address_line_2 || '',
            boe_id: mode === 'SALE' && boe?.id ? boe.id : null,
            lines,
        };
    };

    // ---- actions ----
    const handleSave = async () => {
        if (!validate()) {
            toast.error('Please fix validation errors.');
            return;
        }
        try {
            const payload = buildTradePayload();
            const res = trade?.id
                ? await axios.put(`/trades/${trade.id}/`, payload)
                : await axios.post('/trades/', payload);

            const saved = res.data;

            const mapped = {
                id: saved.id,
                invoice_number: saved.invoice_number,
                invoice_date: saved.invoice_date,
                to_company_name: saved?.to_company?.name || toSnap.name || '',
                to_company_pan: saved.to_pan || '',
                to_company_gst_number: saved.to_gst || '',
                to_company_address_line_1: saved.to_addr_line_1 || '',
                to_company_address_line_2: saved.to_addr_line_2 || '',
                billing_mode: inferBillingModeFromLines(saved.lines),
                from_company_id: saved.from_company?.id || null,
                items: (saved.lines || []).map((ln) => {
                    if (ln.mode === 'QTY') {
                        const rate = toNum(ln.rate_inr_per_kg);
                        const qty = toNum(ln.qty_kg);
                        return {
                            _rid: newRid(),
                            license_no: ln?.sr_number?.license_no || ln?.sr_number?.display_name || '',
                            sr_id: ln?.sr_number?.id,
                            sr_label: ln?.sr_number?.display_name || '',
                            hsn_code: ln?.description || HSN_DEFAULT,
                            qty: String(qty),
                            cif_fc: '',
                            exchange_rate: '',
                            cif_inr: '',
                            fob_inr: '',
                            rate: String(rate),
                            amount: String((qty * rate).toFixed(2)),
                        };
                    }
                    if (ln.mode === 'FOB_INR') {
                        const pct = toNum(ln.pct);
                        const fob = toNum(ln.fob_inr);
                        return {
                            _rid: newRid(),
                            license_no: ln?.sr_number?.license_no || ln?.sr_number?.display_name || '',
                            sr_id: ln?.sr_number?.id,
                            sr_label: ln?.sr_number?.display_name || '',
                            hsn_code: ln?.description || HSN_DEFAULT,
                            qty: '',
                            cif_fc: '',
                            exchange_rate: '',
                            cif_inr: '',
                            fob_inr: String(fob),
                            rate: String(pct),
                            amount: String(((fob * pct) / 100).toFixed(2)),
                        };
                    }
                    const pct = toNum(ln.pct);
                    const cif = toNum(ln.cif_inr);
                    return {
                        _rid: newRid(),
                        license_no: ln?.sr_number?.license_no || ln?.sr_number?.display_name || '',
                        sr_id: ln?.sr_number?.id,
                        sr_label: ln?.sr_number?.display_name || '',
                        hsn_code: ln?.description || HSN_DEFAULT,
                        qty: '',
                        cif_fc: '',
                        exchange_rate: '',
                        cif_inr: String(cif),
                        fob_inr: '',
                        rate: String(pct),
                        amount: String(((cif * pct) / 100).toFixed(2)),
                    };
                }),
            };

            if (mode === 'SALE' && fetchByBoe && boe?.id) {
                setTradeList((prev) => {
                    const exists = prev.some((x) => String(x.id) === String(mapped.id));
                    const next = exists ? prev.map((x) => (String(x.id) === String(mapped.id) ? mapped : x)) : [mapped, ...prev];
                    return next.sort((a, b) => {
                        const ad = new Date(a.invoice_date || 0).getTime();
                        const bd = new Date(b.invoice_date || 0).getTime();
                        if (ad !== bd) return bd - ad;
                        return (b.id || 0) - (a.id || 0);
                    });
                });
                setSelectedTradeId(String(mapped.id));
            }

            setTrade(mapped);
            setIsEditing(false);
            setInvoiceDate(String(mapped.invoice_date || '').slice(0, 10));
            toast.success('Trade saved');
            onSaved?.(saved.id, saved);
        } catch (err) {
            const apiErrors = err.response?.data;
            const newErrors = {};
            if (apiErrors && typeof apiErrors === 'object') {
                for (const key in apiErrors) {
                    if (Array.isArray(apiErrors[key])) newErrors[key] = apiErrors[key].join(', ');
                    else if (typeof apiErrors[key] === 'object') {
                        for (const subKey in apiErrors[key]) {
                            const fullKey = `${key}_${subKey}`;
                            if (Array.isArray(apiErrors[key][subKey])) newErrors[fullKey] = apiErrors[key][subKey].join(', ');
                            else newErrors[fullKey] = apiErrors[key][subKey];
                        }
                    }
                }
            }
            setErrors(newErrors);
            toast.error('Save failed. Please check the form for issues.');
        }
    };

    const handleDelete = async () => {
        if (!trade?.id) return toast.error('No trade to delete.');
        if (!window.confirm('Are you sure you want to delete this trade?')) return;
        try {
            await axios.delete(`/trades/${trade.id}/`);
            toast.success('Trade deleted');

            if (mode === 'SALE' && fetchByBoe && boe?.id) {
                setTradeList((prev) => prev.filter((x) => String(x.id) !== String(trade.id)));
                setSelectedTradeId('NEW');
            }

            setTrade(null);
            setIsEditing(true);
            setInvoiceDate('');
            onSaved?.(trade.id, null);
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleGenerate = async () => {
        if (!trade?.id) return toast.error('Please save before generating the PDF.');
        try {
            const res = await axios.get(`/trades/${trade.id}/invoice-pdf/`, {responseType: 'blob'});
            const blob = new Blob([res.data], {type: 'application/pdf'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${trade.invoice_number || 'invoice'}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to download invoice PDF.');
        }
    };

    const handlePrefillInvoiceNumber = async () => {
        if (!seller?.id) return toast.warn('Select From Company first.');
        try {
            const {data} = await axios.get('/trades/next-invoice/', {
                params: {seller: seller.id, date: invoiceDate || undefined},
            });
            const nextNo = data?.invoice_number;
            if (!nextNo) return toast.error('Could not fetch next invoice number.');
            setTrade((p) => ({...(p || {}), invoice_number: nextNo}));
            toast.success(`Invoice #: ${nextNo}`);
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to fetch next invoice number.');
        }
    };

    if (loading) return <Spinner/>;

    // ---------- VIEW ----------
    const ViewBlock = () => {
        const bm = trade?.billing_mode || billingMode;
        const showByKg = bm === 'kg';
        const showByCIF = bm === 'cif_inr';
        const showByFOB = bm === 'fob_inr';

        return (
            <div className="p-3 bg-light rounded">
                {(mode === 'SALE' && fetchByBoe && boe?.id) && (
                    <Row className="mb-3 align-items-end">
                        <Col md={6}>
                            <Form.Label>Trade</Form.Label>
                            <Form.Select value={selectedTradeId} onChange={(e) => setSelectedTradeId(e.target.value)}>
                                <option value="NEW">+ Create New Trade</option>
                                {tradeList.map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                        #{inv.invoice_number || inv.id} — {inv.to_company_name || '—'}
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
                )}

                <h5 className="text-danger">Invoice #: {trade?.invoice_number || '—'}</h5>
                <p><strong>Date:</strong> {invoiceDate || '—'}</p>

                <Row className="mb-2">
                    <Col md={6}>
                        <h6>From Company</h6>
                        <div>{seller?.name || (seller?.id ? `ID: ${seller.id}` : '—')}</div>
                        <div>PAN: {fromSnap.pan || '—'} | GST: {fromSnap.gst_number || '—'}</div>
                        <div>{fromSnap.address_line_1 || '—'}</div>
                        <div>{fromSnap.address_line_2 || ''}</div>
                    </Col>
                    <Col md={6}>
                        <h6>To Company</h6>
                        <div>{buyer?.name || toSnap.name || '—'}</div>
                        <div>PAN: {toSnap.pan || '—'} | GST: {toSnap.gst_number || '—'}</div>
                        <div>{toSnap.address_line_1 || '—'}</div>
                        <div>{toSnap.address_line_2 || ''}</div>
                    </Col>
                </Row>

                <Table bordered size="sm" className="mt-3">
                    <thead>
                    <tr>
                        <th>#</th>
                        <th>License (SR)</th>
                        {showByKg && (<>
                            <th>HSN</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </>)}
                        {showByCIF && (<>
                            <th>HSN</th>
                            <th>CIF $</th>
                            <th>Exch Rate</th>
                            <th>CIF INR</th>
                            <th>Billing %</th>
                            <th>Amount</th>
                        </>)}
                        {showByFOB && (<>
                            <th>HSN</th>
                            <th>FOB INR</th>
                            <th>Billing %</th>
                            <th>Amount</th>
                        </>)}
                    </tr>
                    </thead>
                    <tbody>
                    {(trade?.items || []).map((it, idx) => (
                        <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{it.license_no}</td>
                            {showByKg && (<>
                                <td>{it.hsn_code || HSN_DEFAULT}</td>
                                <td>{it.qty}</td>
                                <td>{it.rate}</td>
                                <td>{Number(it.amount || 0).toFixed(2)}</td>
                            </>)}
                            {showByCIF && (
                                <>
                                    <td>{it.hsn_code || HSN_DEFAULT}</td>
                                    <td>{it.cif_fc}</td>
                                    <td>{it.exchange_rate}</td>
                                    <td>{it.cif_inr}</td>
                                    <td>{it.rate}</td>
                                    <td>{Number(it.amount || 0).toFixed(2)}</td>
                                </>
                            )}
                            {showByFOB && (<>
                                <td>{it.hsn_code || HSN_DEFAULT}</td>
                                <td>{it.fob_inr}</td>
                                <td>{it.rate}</td>
                                <td>{Number(it.amount || 0).toFixed(2)}</td>
                            </>)}
                        </tr>
                    ))}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={2}><strong>Total</strong></td>
                        {showByKg && (<>
                            <td/>
                            <td><strong>{totals.qty}</strong></td>
                            <td/>
                            <td><strong>{totals.amount}</strong></td>
                        </>)}
                        {showByCIF && (<>
                            <td/>
                            <td><strong>{totals.cif_fc}</strong></td>
                            <td/>
                            <td><strong>{totals.cif_inr}</strong></td>
                            <td/>
                            <td><strong>{totals.amount}</strong></td>
                        </>)}
                        {showByFOB && (<>
                            <td/>
                            <td><strong>{totals.fob_inr}</strong></td>
                            <td/>
                            <td><strong>{totals.amount}</strong></td>
                        </>)}
                    </tr>
                    </tfoot>
                </Table>
            </div>
        );
    };

    // ---------- EDIT ----------
    const EditBlock = () => {
        const showByKg = billingMode === 'kg';
        const showByCIF = billingMode === 'cif_inr';
        const showByFOB = billingMode === 'fob_inr';

        return (
            <Form className="p-3 bg-light rounded">
                {(mode === 'SALE' && fetchByBoe && boe?.id) && (
                    <Row className="mb-3 align-items-end">
                        <Col md={6}>
                            <Form.Label>Trade</Form.Label>
                            <Form.Select value={selectedTradeId} onChange={(e) => setSelectedTradeId(e.target.value)}>
                                <option value="NEW">+ Create New Trade</option>
                                {tradeList.map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                        #{inv.invoice_number || inv.id} — {inv.to_company_name || '—'}
                                    </option>
                                ))}
                            </Form.Select>
                        </Col>
                        <Col md="auto" className="text-end">
                            <Button variant="outline-primary" onClick={() => setSelectedTradeId('NEW')}>New</Button>
                        </Col>
                    </Row>
                )}

                {/* Parties */}
                <Row className="mb-2">
                    <Col md={6}>
                        <Form.Label>From Company (Seller)</Form.Label>
                        <AsyncCompanySelect value={seller} onChange={setSeller} placeholder="Select from company…"/>
                        {errors.from_company_id &&
                            <div className="text-danger small mt-1">{errors.from_company_id}</div>}
                        <div className="mt-2">
                            <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={async () => {
                                    if (!seller?.id) return toast.warn('Select From Company first');
                                    const snap = await fetchCompany(seller.id);
                                    if (!snap) return toast.error('Failed to fetch company details');
                                    applyToSellerFromObj(snap);
                                    toast.success('From Company details fetched');
                                }}
                            >
                                Prefill From Company details
                            </Button>
                        </div>
                    </Col>

                    <Col md={6}>
                        <Form.Label>To Company (Buyer)</Form.Label>
                        <AsyncCompanySelect
                            value={buyer}
                            onChange={(val) => {
                                setBuyer(val);
                                setToSnap((prev) => ({...prev, name: val?.name || prev.name || ''}));
                            }}
                            placeholder="Select to company…"
                        />
                        {mode === 'SALE' && errors.to_company_id && (
                            <div className="text-danger small mt-1">{errors.to_company_id}</div>
                        )}
                        <div className="mt-2">
                            <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={async () => {
                                    if (!buyer?.id) return toast.warn('Select To Company first');
                                    const snap = await fetchCompany(buyer.id);
                                    if (!snap) return toast.error('Failed to fetch company details');
                                    applyToBuyerFromObj(snap);
                                    toast.success('To Company details fetched');
                                }}
                            >
                                Prefill To Company details
                            </Button>
                        </div>
                    </Col>
                </Row>

                {/* Snapshots */}
                <Row className="mb-3">
                    <Col md={6}>
                        <h6 className="mb-2">From Company Snapshot</h6>
                        <Row>
                            <Col md={6}>
                                <ValidatedInput
                                    label="PAN"
                                    value={fromSnap.pan || ''}
                                    onChange={(e) => setFromSnap((p) => ({...p, pan: e.target.value.toUpperCase()}))}
                                    placeholder="PAN"
                                />
                            </Col>
                            <Col md={6}>
                                <ValidatedInput
                                    label="GST"
                                    value={fromSnap.gst_number || ''}
                                    onChange={(e) => setFromSnap((p) => ({
                                        ...p,
                                        gst_number: e.target.value.toUpperCase()
                                    }))}
                                    placeholder="GST"
                                />
                            </Col>
                            <Col md={6}>
                                <ValidatedInput
                                    label="Address Line 1"
                                    value={fromSnap.address_line_1 || ''}
                                    onChange={(e) => setFromSnap((p) => ({
                                        ...p,
                                        address_line_1: e.target.value.toUpperCase()
                                    }))}
                                    placeholder="Address Line 1.."
                                />
                            </Col>
                            <Col md={6}>
                                <ValidatedInput
                                    label="Address Line 2"
                                    value={fromSnap.address_line_2 || ''}
                                    onChange={(e) => setFromSnap((p) => ({
                                        ...p,
                                        address_line_2: e.target.value.toUpperCase()
                                    }))}
                                    placeholder="Address Line 2.."
                                />
                            </Col>
                        </Row>
                    </Col>

                    <Col md={6}>
                        <h6 className="mb-2">To Company Snapshot</h6>
                        <Row>
                            <Col md={6}>
                                <ValidatedInput
                                    label="PAN"
                                    value={toSnap.pan || ''}
                                    onChange={(e) => setToSnap((p) => ({...p, pan: e.target.value.toUpperCase()}))}
                                    placeholder="PAN"
                                    error={mode === 'SALE' ? errors.to_company_pan : undefined}
                                />
                            </Col>
                            <Col md={6}>
                                <ValidatedInput
                                    label="GST"
                                    value={toSnap.gst_number || ''}
                                    onChange={(e) => setToSnap((p) => ({
                                        ...p,
                                        gst_number: e.target.value.toUpperCase()
                                    }))}
                                    placeholder="GST"
                                    error={mode === 'SALE' ? errors.to_company_gst : undefined}
                                />
                            </Col>
                            <Col md={6}>
                                <ValidatedInput
                                    label="Address Line 1"
                                    value={toSnap.address_line_1 || ''}
                                    onChange={(e) => setToSnap((p) => ({
                                        ...p,
                                        address_line_1: e.target.value.toUpperCase()
                                    }))}
                                    placeholder="Address Line 1.."
                                />
                            </Col>
                            <Col md={6}>
                                <ValidatedInput
                                    label="Address Line 2"
                                    value={toSnap.address_line_2 || ''}
                                    onChange={(e) => setToSnap((p) => ({
                                        ...p,
                                        address_line_2: e.target.value.toUpperCase()
                                    }))}
                                    placeholder="Address Line 2.."
                                />
                            </Col>
                        </Row>
                    </Col>
                </Row>

                {/* Header */}
                <Row className="mb-3">
                    <Col md={6}>
                        <ValidatedInput
                            label="Invoice Number (optional)"
                            value={trade?.invoice_number || ''}
                            onChange={(e) => setTrade((p) => ({...(p || {}), invoice_number: e.target.value}))}
                            placeholder="Leave blank to auto-generate"
                            error={errors.invoice_number}
                        />
                        <Button
                            size="sm"
                            className="mt-2"
                            variant="outline-secondary"
                            onClick={handlePrefillInvoiceNumber}
                        >
                            Prefill Invoice #
                        </Button>
                    </Col>
                    <Col md={3}>
                        <Form.Label>Invoice Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            isInvalid={!!errors.invoice_date}
                        />
                        <Form.Control.Feedback type="invalid">{errors.invoice_date}</Form.Control.Feedback>
                    </Col>
                    {mode === 'SALE' && boe?.id && (
                        <Col md={3} className="d-flex align-items-end">
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => {
                                    prefillFromBOE();
                                    toast.success('Items prefetched from BOE');
                                }}
                            >
                                Prefill from BOE
                            </Button>
                        </Col>
                    )}
                </Row>

                {/* Billing mode */}
                <Form.Group className="mb-3">
                    <Form.Label>Billing Mode</Form.Label><br/>
                    <Form.Check inline type="radio" label="By KG" checked={billingMode === 'kg'}
                                onChange={() => handleBillingModeChange('kg')}/>
                    <Form.Check inline type="radio" label="By CIF INR (%)" checked={billingMode === 'cif_inr'}
                                onChange={() => handleBillingModeChange('cif_inr')}/>
                    <Form.Check inline type="radio" label="By FOB INR (%)" checked={billingMode === 'fob_inr'}
                                onChange={() => handleBillingModeChange('fob_inr')}/>
                </Form.Group>

                {/* Lines */}
                <Table bordered size="sm">
                    <thead>
                    <tr>
                        <th>#</th>
                        <th style={{minWidth: 280}}>License (SR)</th>
                        <th>HSN</th>
                        {billingMode === 'kg' && (<th>Qty</th>)}
                        {billingMode === 'cif_inr' && (<>
                            <th>CIF $</th>
                            <th>Exch Rate</th>
                            <th>CIF INR</th>
                        </>)}
                        {billingMode === 'fob_inr' && (<th>FOB INR</th>)}
                        <th>{billingMode === 'kg' ? 'Rate ₹/kg' : 'Billing %'}</th>
                        <th>Amount</th>
                        <th/>
                    </tr>
                    </thead>
                    <tbody>
                    {(items || []).map((it, idx) => (
                        <tr key={it._rid}>
                            <td>{idx + 1}</td>
                            <td>
                                <AsyncSrNumberSelect
                                    value={srOptionFromRow(it)}
                                    onChange={(opt) => handleSrChange(it._rid, opt)}
                                    placeholder="Select License SR…"
                                    getOptionLabel={(opt) => opt?.data?.display_name || opt?.label || ''}
                                    getOptionValue={(opt) => String(opt?.value ?? '')}
                                />
                                {errors[`item_${idx}_sr`] &&
                                    <div className="text-danger small mt-1">{errors[`item_${idx}_sr`]}</div>}
                            </td>
                            <td>
                                <Form.Control
                                    size="sm"
                                    value={it.hsn_code ?? HSN_DEFAULT}
                                    onChange={(e) => updateRowField(it._rid, 'hsn_code', e.target.value)}
                                />
                            </td>

                            {billingMode === 'kg' && (
                                <td>
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        value={it.qty ?? ''}
                                        onChange={(e) => updateRowField(it._rid, 'qty', e.target.value)}
                                        isInvalid={!!errors[`item_${idx}_qty`]}
                                    />
                                </td>
                            )}

                            {billingMode === 'cif_inr' && (
                                <>
                                    <td>
                                        <Form.Control
                                            type="number"
                                            size="sm"
                                            value={it.cif_fc ?? ''}
                                            onChange={(e) => updateRowField(it._rid, 'cif_fc', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <Form.Control
                                            type="number"
                                            size="sm"
                                            value={it.exchange_rate ?? (boe?.exchange_rate ?? '')}
                                            onChange={(e) => updateRowField(it._rid, 'exchange_rate', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <Form.Control
                                            type="number"
                                            size="sm"
                                            value={it.cif_inr ?? ''}
                                            onChange={(e) => updateRowField(it._rid, 'cif_inr', e.target.value)}
                                            isInvalid={!!errors[`item_${idx}_inr`]}
                                        />
                                    </td>
                                </>
                            )}

                            {billingMode === 'fob_inr' && (
                                <td>
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        value={it.fob_inr ?? ''}
                                        onChange={(e) => updateRowField(it._rid, 'fob_inr', e.target.value)}
                                        isInvalid={!!errors[`item_${idx}_fob`]}
                                    />
                                </td>
                            )}

                            <td>
                                <Form.Control
                                    type="number"
                                    step="0.01"
                                    size="sm"
                                    value={it.rate ?? ''}
                                    onChange={(e) => updateRowField(it._rid, 'rate', e.target.value)}
                                    isInvalid={!!errors[`item_${idx}_rate`]}
                                />
                            </td>
                            <td>{Number(toNum(it.amount)).toFixed(2)}</td>
                            <td>
                                <Button size="sm" variant="danger" onClick={() => removeItem(it._rid)}>✖</Button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={3}><strong>Total</strong></td>
                        {billingMode === 'kg' && (<>
                            <td>{totals.qty}</td>
                            <td>-</td>
                            <td>{totals.amount}</td>
                        </>)}
                        {billingMode === 'cif_inr' && (<>
                            <td>{totals.cif_fc}</td>
                            <td/>
                            {/* rate */}
                            <td>{totals.cif_inr}</td>
                            <td/>
                            {/* % */}
                            <td>{totals.amount}</td>
                        </>)}
                        {billingMode === 'fob_inr' && (<>
                            <td>{totals.fob_inr}</td>
                            <td/>
                            {/* % */}
                            <td>{totals.amount}</td>
                        </>)}
                        <td/>
                    </tr>
                    </tfoot>
                </Table>

                <Button
                    size="sm"
                    onClick={() =>
                        setItems((prev) => [
                            ...prev,
                            {
                                _rid: newRid(),
                                sr_id: null,
                                sr_label: '',
                                license_no: '',
                                hsn_code: HSN_DEFAULT,
                                qty: '',
                                cif_fc: '',
                                exchange_rate: boe?.exchange_rate ? String(boe.exchange_rate) : '',
                                cif_inr: '',
                                fob_inr: '',
                                rate: '',
                                amount: '0',
                            },
                        ])
                    }
                >
                    Add Line
                </Button>

                <hr/>
                <Button onClick={handleSave}>Save Trade</Button>
                {trade && <Button className="ms-2" onClick={() => setIsEditing(false)}>Cancel</Button>}
                {trade && mode === 'SALE' && <Button className="ms-2" onClick={handleGenerate}>Download PDF</Button>}
            </Form>
        );
    };

    return isEditing ? <EditBlock/> : <ViewBlock/>;
};

export default TradeInvoiceCore;
