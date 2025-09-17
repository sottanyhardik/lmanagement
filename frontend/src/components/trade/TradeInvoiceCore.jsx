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
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const rid = () => Math.random().toString(36).slice(2, 9);

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

const modes = {
    KG: 'kg',
    CIF: 'cif_inr',
    FOB: 'fob_inr',
};

const TradeInvoiceCore = ({
                              mode = 'SALE',       // "SALE" | "PURCHASE"
                              boe = null,          // optional BOE object (for SALE seeding)
                              initialTrade = null, // optional trade to view/edit (mapped shape not required)
                              fetchByBoe = true,   // if true (SALE+boe), fetch existing sales trades for selector
                              onSaved,
                          }) => {
    const [loading, setLoading] = useState(true);

    // list of existing trades for BOE (SALE)
    const [tradeList, setTradeList] = useState([]);
    const [selectedTradeId, setSelectedTradeId] = useState('NEW'); // "NEW" | id

    // Parties (company selectors)
    const [seller, setSeller] = useState(null); // from_company
    const [buyer, setBuyer] = useState(null);   // to_company

    // Snapshots
    const [fromSnap, setFromSnap] = useState({pan: '', gst_number: '', address_line_1: '', address_line_2: ''});
    const [toSnap, setToSnap] = useState({name: '', pan: '', gst_number: '', address_line_1: '', address_line_2: ''});

    // Header / items
    const [billingMode, setBillingMode] = useState(modes.KG);
    const [items, setItems] = useState([]);
    const [trade, setTrade] = useState(null);
    const [invoiceDate, setInvoiceDate] = useState(''); // yyyy-mm-dd
    const [errors, setErrors] = useState({});
    const [isEditing, setIsEditing] = useState(true);

    // BOE prefill control
    const boePrefillRunRef = useRef(false);

    // totals
    const dataForTotals = useMemo(
        () => (trade && !isEditing ? trade.items : items) || [],
        [trade, isEditing, items]
    );
    const totals = computeTotals(dataForTotals);

    // ---------- helpers ----------
    const fetchCompany = async (id) => {
        if (!id) return null;
        try {
            const {data} = await axios.get(`/companies/${id}/`);
            return data || null;
        } catch {
            return null;
        }
    };

    const applyBuyerFromObj = (obj) => {
        if (!obj) return;
        setBuyer({id: obj.id, name: obj.name || ''});
        setToSnap((p) => ({
            ...p,
            name: obj.name || p.name || '',
            pan: (obj.pan || p.pan || '').toUpperCase(),
            gst_number: (obj.gst_number || p.gst_number || '').toUpperCase(),
            address_line_1: obj.address_line_1 ?? p.address_line_1 ?? '',
            address_line_2: obj.address_line_2 ?? p.address_line_2 ?? '',
        }));
    };

    const applySellerFromObj = (obj) => {
        if (!obj) return;
        setSeller({id: obj.id, name: obj.name || ''});
        setFromSnap((p) => ({
            ...p,
            name: obj.name || p.name || '',
            pan: (obj.pan || p.pan || '').toUpperCase(),
            gst_number: (obj.gst_number || p.gst_number || '').toUpperCase(),
            address_line_1: obj.address_line_1 ?? p.address_line_1 ?? '',
            address_line_2: obj.address_line_2 ?? p.address_line_2 ?? '',
        }));
    };

    const prefillFromBOE = () => {
        if (!(mode === 'SALE' && boe?.item_details?.length)) return;
        const defaults = (boe.item_details || []).map((d) => ({
            _rid: rid(),
            // SR (for selector and view)
            sr_id: d?.sr_number?.id ?? null,
            sr_label: d?.sr_number?.display_name || '',
            license_no: d?.sr_number?.display_name || '',
            hsn_code: HSN_DEFAULT,

            // By KG branch
            qty: String(d?.qty ?? ''),

            // CIF %
            cif_fc: String(d?.cif_fc ?? ''),       // keep CIF $
            exc_rate: String(boe?.exchange_rate ?? ''), // preferred exchange rate field name
            cif_inr: String(d?.cif_inr ?? ''),

            // FOB %
            fob_inr: '',

            // rate / amount
            rate: '',
            amount: '0',
        }));
        setItems(defaults);
    };

    // ---------- init ----------
    useEffect(() => {
        (async function init() {
            try {
                // SALE: default buyer snapshot from BOE
                if (mode === 'SALE' && boe?.company) {
                    applyBuyerFromObj(boe.company);
                }

                // SALE: default prefill from BOE once
                if (mode === 'SALE' && boe?.item_details?.length) {
                    prefillFromBOE();
                    boePrefillRunRef.current = true;
                }

                // SALE: fetch existing trades for selector
                if (mode === 'SALE' && fetchByBoe && boe?.id) {
                    try {
                        const {data} = await axios.get('/trades/', {
                            params: {direction: 'SALE', boe: boe.id, ordering: '-invoice_date,-id'},
                        });
                        const list = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
                        const mapped = (list || []).map((t) => ({
                            id: t.id,
                            invoice_number: t.invoice_number,
                            invoice_date: t.invoice_date,
                            to_company_name: t?.to_company?.name || '',
                            to_company_pan: t.to_pan || '',
                            to_company_gst_number: t.to_gst || '',
                            to_company_address_line_1: t.to_addr_line_1 || '',
                            to_company_address_line_2: t.to_addr_line_2 || '',
                            from_company_id: t.from_company?.id || null,
                            from_company_name: t?.from_company?.name || '',
                            // derive billing mode
                            billing_mode: (t.lines || []).some((ln) => ln.mode === 'CIF_INR')
                                ? modes.CIF
                                : (t.lines || []).some((ln) => ln.mode === 'FOB_INR')
                                    ? modes.FOB
                                    : modes.KG,
                            // map lines to UI view shape (keep cif_fc / exc_rate)
                            items: (t.lines || []).map((ln) => {
                                const sr = ln?.sr_number || {};
                                if (ln.mode === 'QTY') {
                                    const rate = toNum(ln.rate_inr_per_kg);
                                    const qty = toNum(ln.qty_kg);
                                    return {
                                        _rid: rid(),
                                        license_no: sr.display_name || '',
                                        sr_id: sr.id,
                                        sr_label: sr.display_name || '',
                                        hsn_code: ln?.description || HSN_DEFAULT,
                                        qty: String(qty || ''),
                                        cif_fc: '',
                                        exc_rate: '',
                                        cif_inr: '',
                                        fob_inr: '',
                                        rate: String(rate || ''),
                                        amount: String((qty * rate).toFixed(2)),
                                    };
                                }
                                if (ln.mode === 'CIF_INR') {
                                    const exch = toNum(ln.exc_rate) || toNum(sr.exchange_rate_hint) || toNum(boe?.exchange_rate) || 0;
                                    const cifInr = toNum(ln.cif_inr);
                                    const cifFc = toNum(ln.cif_fc) || (exch ? +(cifInr / exch).toFixed(2) : 0);
                                    return {
                                        _rid: rid(),
                                        license_no: sr.display_name || '',
                                        sr_id: sr.id,
                                        sr_label: sr.display_name || '',
                                        hsn_code: ln?.description || HSN_DEFAULT,
                                        qty: '',
                                        cif_fc: String(cifFc || ''),
                                        exc_rate: exch ? String(exch) : '',
                                        cif_inr: String(cifInr || ''),
                                        fob_inr: '',
                                        rate: String(toNum(ln.pct)),
                                        amount: String(((cifInr * toNum(ln.pct)) / 100).toFixed(2)),
                                    };
                                }
                                // FOB
                                const fobInr = toNum(ln.fob_inr);
                                return {
                                    _rid: rid(),
                                    license_no: sr.display_name || '',
                                    sr_id: sr.id,
                                    sr_label: sr.display_name || '',
                                    hsn_code: ln?.description || HSN_DEFAULT,
                                    qty: '',
                                    cif_fc: '',
                                    exc_rate: '',
                                    cif_inr: '',
                                    fob_inr: String(fobInr || ''),
                                    rate: String(toNum(ln.pct)),
                                    amount: String(((fobInr * toNum(ln.pct)) / 100).toFixed(2)),
                                };
                            }),
                        }));
                        setTradeList(mapped);
                        if (mapped.length) setSelectedTradeId(String(mapped[0].id));
                    } catch { /* ignore */
                    }
                }

                // If editing a pre-fetched trade (external)
                if (initialTrade?.id) {
                    // expect initialTrade to be server model shape
                    const t = initialTrade;
                    setIsEditing(false);
                    setTrade({
                        id: t.id,
                        invoice_number: t.invoice_number,
                        invoice_date: t.invoice_date,
                        // keep items mapped below
                    });
                    setInvoiceDate(String(t.invoice_date || '').slice(0, 10));
                    // mode
                    const bm = (t.lines || []).some((ln) => ln.mode === 'CIF_INR')
                        ? modes.CIF
                        : (t.lines || []).some((ln) => ln.mode === 'FOB_INR')
                            ? modes.FOB
                            : modes.KG;
                    setBillingMode(bm);
                    // parties
                    if (t.from_company?.id) setSeller({id: t.from_company.id, name: t.from_company.name});
                    if (t.to_company?.id) setBuyer({id: t.to_company.id, name: t.to_company.name});
                    // snapshots
                    setFromSnap({
                        name: t.from_pan?.name || '',
                        pan: (t.from_pan || '').toUpperCase(),
                        gst_number: (t.from_gst || '').toUpperCase(),
                        address_line_1: t.from_addr_line_1 || '',
                        address_line_2: t.from_addr_line_2 || '',
                    });
                    setToSnap({
                        name: t.to_company?.name || '',
                        pan: (t.to_pan || '').toUpperCase(),
                        gst_number: (t.to_gst || '').toUpperCase(),
                        address_line_1: t.to_addr_line_1 || '',
                        address_line_2: t.to_addr_line_2 || '',
                    });
                    // lines
                    const mapped = (t.lines || []).map((ln) => {
                        const sr = ln?.sr_number || {};
                        if (ln.mode === 'QTY') {
                            const rate = toNum(ln.rate_inr_per_kg);
                            const qty = toNum(ln.qty_kg);
                            return {
                                _rid: rid(),
                                license_no: sr.display_name || '',
                                sr_id: sr.id,
                                sr_label: sr.display_name || '',
                                hsn_code: ln?.description || HSN_DEFAULT,
                                qty: String(qty || ''),
                                cif_fc: '',
                                exc_rate: '',
                                cif_inr: '',
                                fob_inr: '',
                                rate: String(rate || ''),
                                amount: String((qty * rate).toFixed(2)),
                            };
                        }
                        if (ln.mode === 'CIF_INR') {
                            const exch = toNum(ln.exc_rate) || toNum(sr.exchange_rate_hint) || toNum(boe?.exchange_rate) || 0;
                            const cifInr = toNum(ln.cif_inr);
                            const cifFc = toNum(ln.cif_fc) || (exch ? +(cifInr / exch).toFixed(2) : 0);
                            return {
                                _rid: rid(),
                                license_no: sr.display_name || '',
                                sr_id: sr.id,
                                sr_label: sr.display_name || '',
                                hsn_code: ln?.description || HSN_DEFAULT,
                                qty: '',
                                cif_fc: String(cifFc || ''),
                                exc_rate: exch ? String(exch) : '',
                                cif_inr: String(cifInr || ''),
                                fob_inr: '',
                                rate: String(toNum(ln.pct)),
                                amount: String(((cifInr * toNum(ln.pct)) / 100).toFixed(2)),
                            };
                        }
                        // FOB
                        const fobInr = toNum(ln.fob_inr);
                        return {
                            _rid: rid(),
                            license_no: sr.display_name || '',
                            sr_id: sr.id,
                            sr_label: sr.display_name || '',
                            hsn_code: ln?.description || HSN_DEFAULT,
                            qty: '',
                            cif_fc: '',
                            exc_rate: '',
                            cif_inr: '',
                            fob_inr: String(fobInr || ''),
                            rate: String(toNum(ln.pct)),
                            amount: String(((fobInr * toNum(ln.pct)) / 100).toFixed(2)),
                        };
                    });
                    setItems(mapped);
                    setSelectedTradeId(String(t.id));
                } else if (!(mode === 'SALE' && fetchByBoe && boe?.id)) {
                    setSelectedTradeId('NEW');
                    setIsEditing(true);
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [mode, boe, fetchByBoe, initialTrade]);

    // If BOE exists and items ended up empty, allow *one more* auto-prefill
    useEffect(() => {
        if (mode !== 'SALE' || !boe?.item_details?.length) return;
        if ((items?.length || 0) === 0 && !boePrefillRunRef.current) {
            prefillFromBOE();
            boePrefillRunRef.current = true;
        }
    }, [mode, boe, items]);

    // selector (SALE)
    useEffect(() => {
        if (selectedTradeId === 'NEW') {
            setTrade(null);
            setIsEditing(true);
            setInvoiceDate('');
            setBillingMode(modes.KG);
            return;
        }
        const inv = tradeList.find((x) => String(x.id) === String(selectedTradeId));
        if (!inv) return;
        const mappedItems = (inv.items || []).map((it) => ({
            ...it,
            qty: it.qty ?? '',
            cif_fc: it.cif_fc ?? '',
            exc_rate: it.exc_rate ?? '',
            cif_inr: it.cif_inr ?? '',
            fob_inr: it.fob_inr ?? '',
            rate: it.rate ?? '',
            amount: it.amount ?? '',
        }));
        setTrade({...inv, items: mappedItems});
        setIsEditing(false);
        setInvoiceDate(String(inv.invoice_date || '').slice(0, 10));
        setBillingMode(inv.billing_mode || modes.KG);
        setSeller(
            inv.from_company_id
                ? {value: inv.from_company_id, label: inv.from_company_name || `ID: ${inv.from_company_id}`}
                : null
        );
        setFromSnap((p) => ({
            ...p,
            name: inv.from_company_name || p.name || '',
            pan: inv.from_company_pan || p.pan || '',
            gst_number: inv.from_company_gst_number || p.gst_number || '',
            address_line_1: inv.from_company_address_line_1 || p.address_line_1 || '',
            address_line_2: inv.from_company_address_line_2 || p.address_line_2 || '',
        }));
        setToSnap((p) => ({
            ...p,
            name: inv.to_company_name || p.name || '',
            pan: inv.to_company_pan || p.pan || '',
            gst_number: inv.to_company_gst_number || p.gst_number || '',
            address_line_1: inv.to_company_address_line_1 || p.address_line_1 || '',
            address_line_2: inv.to_company_address_line_2 || p.address_line_2 || '',
        }));
        setItems(mappedItems);
    }, [selectedTradeId, tradeList]);

    // ---------- row updates (no focus loss) ----------
    const updateRowField = (rowId, field, value) => {
        setItems((prev) => {
            const next = prev.map((r) => (r._rid === rowId ? {...r} : r));
            const row = next.find((r) => r._rid === rowId);
            if (!row) return prev;

            row[field] = value;

            // calculate dependent fields per mode
            const rmode = billingMode;
            if (rmode === modes.KG) {
                const q = toNum(row.qty);
                const rate = toNum(row.rate);
                row.amount = String((q * rate).toFixed(2));
            } else if (rmode === modes.CIF) {
                // if user edits cif_fc or exc_rate and cif_inr is blank, derive it
                if ((field === 'cif_fc' || field === 'exc_rate') && !toNum(row.cif_inr)) {
                    const cf = toNum(row.cif_fc);
                    const er = toNum(row.exc_rate || boe?.exchange_rate);
                    if (cf && er) row.cif_inr = String((cf * er).toFixed(2));
                }
                const base = toNum(row.cif_inr);
                const pct = toNum(row.rate);
                row.amount = String(((base * pct) / 100).toFixed(2));
            } else if (rmode === modes.FOB) {
                const base = toNum(row.fob_inr);
                const pct = toNum(row.rate);
                row.amount = String(((base * pct) / 100).toFixed(2));
            }
            return next;
        });
    };

    const removeRow = (rowId) => {
        setItems((prev) => prev.filter((r) => r._rid !== rowId));
    };

    const addRow = () => {
        setItems((prev) => [
            ...prev,
            {
                _rid: rid(),
                sr_id: null,
                sr_label: '',
                license_no: '',
                hsn_code: HSN_DEFAULT,
                qty: '',
                cif_fc: '',
                exc_rate: '',
                cif_inr: '',
                fob_inr: '',
                rate: '',
                amount: '0',
            },
        ]);
    };

    // ---------- validation (only on save) ----------
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
            if (billingMode === modes.KG) {
                if (!Number.isFinite(toNum(it.qty))) newErrors[`item_${idx}_qty`] = 'Qty is required.';
            } else if (billingMode === modes.CIF) {
                if (!Number.isFinite(toNum(it.cif_inr)) && !(toNum(it.cif_fc) && toNum(it.exc_rate))) {
                    newErrors[`item_${idx}_inr`] = 'CIF (INR) or (CIF $ × Rate) is required.';
                }
            } else if (billingMode === modes.FOB) {
                if (!Number.isFinite(toNum(it.fob_inr))) newErrors[`item_${idx}_fob`] = 'FOB (INR) is required.';
            }
            if (!Number.isFinite(toNum(it.rate))) newErrors[`item_${idx}_rate`] = 'Valid rate is required.';
            if (!it.sr_id) newErrors[`item_${idx}_sr`] = 'Select a License (SR).';
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ---------- save payload ----------
    const buildPayload = () => {
        const lines = (items || []).map((it) => {
            if (billingMode === modes.KG) {
                return {
                    sr_number: it.sr_id,
                    description: it.hsn_code || HSN_DEFAULT,
                    mode: 'QTY',
                    qty_kg: toNum(it.qty),
                    rate_inr_per_kg: toNum(it.rate),
                    // present but unused in this mode (ignored by server)
                    cif_fc: 0,
                    exc_rate: 0,
                    cif_inr: 0,
                    fob_inr: 0,
                    pct: 0,
                };
            }
            if (billingMode === modes.CIF) {
                const cifInr =
                    toNum(it.cif_inr) ||
                    (toNum(it.cif_fc) * (toNum(it.exc_rate || boe?.exchange_rate)));
                return {
                    sr_number: it.sr_id,
                    description: it.hsn_code || HSN_DEFAULT,
                    mode: 'CIF_INR',
                    qty_kg: 0,
                    rate_inr_per_kg: 0,
                    cif_fc: toNum(it.cif_fc),
                    exc_rate: toNum(it.exc_rate || boe?.exchange_rate),
                    cif_inr: toNum(cifInr),
                    fob_inr: 0,
                    pct: toNum(it.rate),
                };
            }
            // FOB
            return {
                sr_number: it.sr_id,
                description: it.hsn_code || HSN_DEFAULT,
                mode: 'FOB_INR',
                qty_kg: 0,
                rate_inr_per_kg: 0,
                cif_fc: 0,
                exc_rate: 0,
                cif_inr: 0,
                fob_inr: toNum(it.fob_inr),
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

            // snapshots for BOTH sides (persisted per your serializer)
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

    // ---------- actions ----------
    const handleSave = async () => {
        if (!validate()) {
            toast.error('Please fix validation errors.');
            return;
        }
        try {
            const payload = buildPayload();
            const res = trade?.id
                ? await axios.put(`/trades/${trade.id}/`, payload)
                : await axios.post('/trades/', payload);
            const saved = res.data;

            // Map saved to view
            const mappedItems = (saved.lines || []).map((ln) => {
                const sr = ln?.sr_number || {};
                if (ln.mode === 'QTY') {
                    const rate = toNum(ln.rate_inr_per_kg);
                    const qty = toNum(ln.qty_kg);
                    return {
                        _rid: rid(),
                        license_no: sr.display_name || '',
                        sr_id: sr.id,
                        sr_label: sr.display_name || '',
                        hsn_code: ln?.description || HSN_DEFAULT,
                        qty: String(qty || ''),
                        cif_fc: '',
                        exc_rate: '',
                        cif_inr: '',
                        fob_inr: '',
                        rate: String(rate || ''),
                        amount: String((qty * rate).toFixed(2)),
                    };
                }
                if (ln.mode === 'CIF_INR') {
                    const exch = toNum(ln.exc_rate) || toNum(sr.exchange_rate_hint) || toNum(boe?.exchange_rate) || 0;
                    const cifInr = toNum(ln.cif_inr);
                    const cifFc = toNum(ln.cif_fc) || (exch ? +(cifInr / exch).toFixed(2) : 0);
                    return {
                        _rid: rid(),
                        license_no: sr.display_name || '',
                        sr_id: sr.id,
                        sr_label: sr.display_name || '',
                        hsn_code: ln?.description || HSN_DEFAULT,
                        qty: '',
                        cif_fc: String(cifFc || ''),
                        exc_rate: exch ? String(exch) : '',
                        cif_inr: String(cifInr || ''),
                        fob_inr: '',
                        rate: String(toNum(ln.pct)),
                        amount: String(((cifInr * toNum(ln.pct)) / 100).toFixed(2)),
                    };
                }
                const fobInr = toNum(ln.fob_inr);
                return {
                    _rid: rid(),
                    license_no: sr.display_name || '',
                    sr_id: sr.id,
                    sr_label: sr.display_name || '',
                    hsn_code: ln?.description || HSN_DEFAULT,
                    qty: '',
                    cif_fc: '',
                    exc_rate: '',
                    cif_inr: '',
                    fob_inr: String(fobInr || ''),
                    rate: String(toNum(ln.pct)),
                    amount: String(((fobInr * toNum(ln.pct)) / 100).toFixed(2)),
                };
            });

            const mapped = {
                id: saved.id,
                invoice_number: saved.invoice_number,
                invoice_date: saved.invoice_date,
                billing_mode: (saved.lines || []).some((ln) => ln.mode === 'CIF_INR')
                    ? modes.CIF
                    : (saved.lines || []).some((ln) => ln.mode === 'FOB_INR')
                        ? modes.FOB
                        : modes.KG,
                items: mappedItems,
            };

            // refresh BOE list if relevant
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

    const prefillInvoiceNumber = async () => {
        if (!seller?.id) return toast.warn('Select From Company first');
        try {
            const params = {seller: seller.id};
            if (invoiceDate) params.date = invoiceDate;
            const {data} = await axios.get('/trades/next-invoice/', {params});
            const inv = data?.invoice_number || '';
            if (!inv) return toast.error('No invoice number generated');
            setTrade((p) => ({...(p || {}), invoice_number: inv}));
            toast.success(`Invoice #: ${inv}`);
        } catch (e) {
            toast.error('Failed to fetch invoice number');
        }
    };

    if (loading) return <Spinner/>;

    // ---------- VIEW ----------
    const ViewBlock = () => {
        const showByKG = (trade?.billing_mode || billingMode) === modes.KG;
        const showByCIF = (trade?.billing_mode || billingMode) === modes.CIF;
        const showByFOB = (trade?.billing_mode || billingMode) === modes.FOB;
        // NEW: render CIF columns if CIF mode OR FOB mode
        const showCIFBlock = showByCIF || showByFOB;

        return (
            <div className="p-3 bg-light rounded">
                {(mode === 'SALE' && fetchByBoe && boe?.id) && (
                    <Row className="mb-3 align-items-end">
                        <Col md={6}>
                            <Form.Label>Trade</Form.Label>
                            <Form.Select
                                value={selectedTradeId}
                                onChange={(e) => setSelectedTradeId(e.target.value)}
                            >
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
                        <div>{seller?.name || fromSnap.name || '—'}</div>
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
                        <th>License</th>
                        <th>HSN</th>
                        {showByKG && (<>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </>)}
                        {showCIFBlock && (
                            <>
                                <th>CIF $</th>
                                <th>Exch Rate</th>
                                <th>CIF INR</th>
                                {/* Only in pure CIF mode show its % and Amount columns */}
                                {showByCIF && (
                                    <>
                                        <th>Billing %</th>
                                        <th>Amount</th>
                                    </>
                                )}
                            </>
                        )}
                        {showByFOB && (<>
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
                            <td>{it.hsn_code || HSN_DEFAULT}</td>
                            {showByKG && (<>
                                <td>{it.qty}</td>
                                <td>{it.rate}</td>
                                <td>{Number(it.amount || 0).toFixed(2)}</td>
                            </>)}
                            {showCIFBlock && (
                                <>
                                    <td>{it.cif_fc}</td>
                                    <td>{it.exc_rate}</td>
                                    <td>{it.cif_inr}</td>
                                    {/* Only in CIF mode show CIF % and Amount */}
                                    {showByCIF && (
                                        <>
                                            <td>{it.rate}</td>
                                            <td>{Number(it.amount || 0).toFixed(2)}</td>
                                        </>
                                    )}
                                </>
                            )}
                            {showByFOB && (<>
                                <td>{it.fob_inr}</td>
                                <td>{it.rate}</td>
                                <td>{Number(it.amount || 0).toFixed(2)}</td>
                            </>)}
                        </tr>
                    ))}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={3}><strong>Total</strong></td>
                        {showByKG && (<>
                            <td><strong>{totals.qty}</strong></td>
                            <td/>
                            <td><strong>{totals.amount}</strong></td>
                        </>)}
                        {showCIFBlock && (
                            <>
                                <td><strong>{totals.cif_fc}</strong></td>
                                <td/>
                                <td><strong>{totals.cif_inr}</strong></td>
                                {/* Only in CIF mode add % and Amount cells here */}
                                {showByCIF && (
                                    <>
                                        <td/>
                                        <td><strong>{totals.amount}</strong></td>
                                    </>
                                )}
                            </>
                        )}
                        {showByFOB && (<>
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
    const EditBlock = () => (
        <Form className="p-3 bg-light rounded">
            {(mode === 'SALE' && fetchByBoe && boe?.id) && (
                <Row className="mb-3 align-items-end">
                    <Col md={6}>
                        <Form.Label>Trade</Form.Label>
                        <Form.Select
                            value={selectedTradeId}
                            onChange={(e) => setSelectedTradeId(e.target.value)}
                        >
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

            {/* Parties (both modes) */}
            <Row className="mb-2">
                <Col md={6}>
                    <Form.Label>From Company (Seller)</Form.Label>
                    <AsyncCompanySelect
                        value={seller}
                        onChange={(val) => setSeller(val)}
                        placeholder="Select from company…"
                    />
                    {errors.from_company_id && <div className="text-danger small mt-1">{errors.from_company_id}</div>}
                    <div className="mt-2">
                        <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={async () => {
                                if (!seller?.id) return toast.warn('Select From Company first');
                                const snap = await fetchCompany(seller.id);
                                if (!snap) return toast.error('Failed to fetch company details');
                                applySellerFromObj(snap);
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
                            setToSnap((p) => ({...p, name: val?.name || p.name || ''}));
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
                                applyBuyerFromObj(snap);
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
                                onChange={(e) => setFromSnap((p) => ({...p, gst_number: e.target.value.toUpperCase()}))}
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
                                onChange={(e) => setToSnap((p) => ({...p, gst_number: e.target.value.toUpperCase()}))}
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
                    <Button className="mt-2" size="sm" variant="outline-secondary" onClick={prefillInvoiceNumber}>
                        Prefill Invoice Number
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
                <Form.Check
                    inline
                    type="radio"
                    label="By KG"
                    checked={billingMode === modes.KG}
                    onChange={() => setBillingMode(modes.KG)}
                />
                <Form.Check
                    inline
                    type="radio"
                    label="By CIF INR (%)"
                    checked={billingMode === modes.CIF}
                    onChange={() => setBillingMode(modes.CIF)}
                />
                <Form.Check
                    inline
                    type="radio"
                    label="By FOB INR (%)"
                    checked={billingMode === modes.FOB}
                    onChange={() => setBillingMode(modes.FOB)}
                />
            </Form.Group>

            {/* Lines */}
            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>#</th>
                    <th style={{minWidth: 260}}>License (SR)</th>
                    <th>HSN</th>
                    {billingMode === modes.KG && (<th>Qty</th>)}
                    {billingMode === modes.CIF && (<>
                        <th>CIF $</th>
                        <th>Exch Rate</th>
                        <th>CIF INR</th>
                    </>)}
                    {billingMode === modes.FOB && (<>
                            <th>CIF $</th>
                            <th>Exch Rate</th>
                            <th>CIF INR</th>
                            <th>FOB INR</th>
                        </>
                    )}
                    <th>{billingMode === modes.KG ? 'Rate ₹/kg' : 'Billing %'}</th>
                    <th>Amount</th>
                    <th/>
                </tr>
                </thead>
                <tbody>
                {(items || []).map((it, idx) => (
                    <tr key={it._rid}>
                        <td>{idx + 1}</td>

                        {/* SR selector */}
                        <td>
                            <AsyncSrNumberSelect
                                value={it.sr_id ? {value: it.sr_id, label: it.sr_label || it.license_no} : null}
                                onChange={(opt) => {
                                    setItems((prev) => {
                                        const next = prev.map((r) => (r._rid === it._rid ? {...r} : r));
                                        const row = next.find((r) => r._rid === it._rid);
                                        if (!row) return prev;
                                        const id = opt?.value ?? opt?.id ?? null;
                                        const lbl = opt?.label || opt?.data?.display_name || '';
                                        row.sr_id = id;
                                        row.sr_label = lbl;
                                        row.license_no = lbl;

                                        // Prefills from SR payload if present
                                        const payload = opt?.data || {};
                                        const balanceCifUsd = payload.license_cif_fc_total ?? payload.available_value ?? null;
                                        const exchHint = toNum(payload.exchange_rate_hint) || toNum(boe?.exchange_rate);

                                        if (billingMode === modes.CIF) {
                                            if (!toNum(row.cif_fc) && balanceCifUsd != null) row.cif_fc = String(balanceCifUsd);
                                            if (!toNum(row.exc_rate) && exchHint) row.exc_rate = String(exchHint);
                                            if (!toNum(row.cif_inr) && toNum(row.cif_fc) && toNum(row.exc_rate)) {
                                                row.cif_inr = String((toNum(row.cif_fc) * toNum(row.exc_rate)).toFixed(2));
                                            }
                                        }
                                        if (billingMode === modes.FOB) {
                                            if (!toNum(row.cif_fc) && balanceCifUsd != null) row.cif_fc = String(balanceCifUsd);
                                            if (!toNum(row.exc_rate) && exchHint) row.exc_rate = String(exchHint);
                                            if (!toNum(row.cif_inr) && toNum(row.cif_fc) && toNum(row.exc_rate)) {
                                                row.cif_inr = String((toNum(row.cif_fc) * toNum(row.exc_rate)).toFixed(2));
                                            }
                                            const fob = payload.license_fob_inr_total ?? payload.available_fob_inr ?? null;
                                            if (!toNum(row.fob_inr) && fob != null) row.fob_inr = String(fob);
                                        }
                                        return next;
                                    });
                                }}
                                placeholder="Search License SR…"
                            />
                            {errors[`item_${idx}_sr`] &&
                                <div className="text-danger small">{errors[`item_${idx}_sr`]}</div>}
                        </td>

                        {/* HSN */}
                        <td style={{minWidth: 110}}>
                            <Form.Control
                                size="sm"
                                value={it.hsn_code ?? HSN_DEFAULT}
                                onChange={(e) => updateRowField(it._rid, 'hsn_code', e.target.value)}
                            />
                        </td>

                        {/* Mode-specific inputs */}
                        {billingMode === modes.KG && (
                            <td style={{maxWidth: 120}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.qty ?? ''}
                                    onChange={(e) => updateRowField(it._rid, 'qty', e.target.value)}
                                    isInvalid={!!errors[`item_${idx}_qty`]}
                                />
                            </td>
                        )}

                        {billingMode === modes.CIF && (<>
                            <td style={{maxWidth: 130}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.cif_fc ?? ''}
                                    onChange={(e) => updateRowField(it._rid, 'cif_fc', e.target.value)}
                                />
                            </td>
                            <td style={{maxWidth: 130}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.exc_rate ?? (boe?.exchange_rate ?? '')}
                                    onChange={(e) => updateRowField(it._rid, 'exc_rate', e.target.value)}
                                />
                            </td>
                            <td style={{maxWidth: 160}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.cif_inr ?? ''}
                                    onChange={(e) => updateRowField(it._rid, 'cif_inr', e.target.value)}
                                    isInvalid={!!errors[`item_${idx}_inr`]}
                                />
                            </td>
                        </>)}
                        {billingMode === modes.FOB && (<>
                            <td style={{maxWidth: 130}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.cif_fc ?? ''}
                                    onChange={(e) => updateRowField(it._rid, 'cif_fc', e.target.value)}
                                />
                            </td>
                            <td style={{maxWidth: 130}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.exc_rate ?? (boe?.exchange_rate ?? '')}
                                    onChange={(e) => updateRowField(it._rid, 'exc_rate', e.target.value)}
                                />
                            </td>
                            <td style={{maxWidth: 160}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.cif_inr ?? ''}
                                    onChange={(e) => updateRowField(it._rid, 'cif_inr', e.target.value)}
                                    isInvalid={!!errors[`item_${idx}_inr`]}
                                />
                            </td>
                            <td style={{maxWidth: 160}}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={it.fob_inr ?? ''}
                                    onChange={(e) => updateRowField(it._rid, 'fob_inr', e.target.value)}
                                    isInvalid={!!errors[`item_${idx}_fob`]}
                                />
                            </td>

                        </>)}

                        {/* Rate / % */}
                        <td style={{maxWidth: 140}}>
                            <Form.Control
                                type="number"
                                step="0.01"
                                size="sm"
                                value={it.rate ?? ''}
                                onChange={(e) => updateRowField(it._rid, 'rate', e.target.value)}
                                isInvalid={!!errors[`item_${idx}_rate`]}
                            />
                        </td>

                        {/* Amount */}
                        <td className="text-end" style={{minWidth: 120}}>
                            {Number(it.amount || 0).toFixed(2)}
                        </td>

                        {/* Actions */}
                        <td className="text-center" style={{width: 70}}>
                            <Button size="sm" variant="danger" onClick={() => removeRow(it._rid)}>✖</Button>
                        </td>
                    </tr>
                ))}
                </tbody>

                <tfoot>
                <tr>
                    <td colSpan={3}><strong>Total</strong></td>
                    {billingMode === modes.KG && (<>
                        <td>{totals.qty}</td>
                        <td>-</td>
                        <td>{totals.amount}</td>
                        <td/>
                    </>)}
                    {billingMode === modes.CIF && (<>
                        <td>{totals.cif_fc}</td>
                        <td/>
                        <td>{totals.cif_inr}</td>
                        <td/>
                        <td>{totals.amount}</td>
                        <td/>
                    </>)}
                    {billingMode === modes.FOB && (<>
                        <td>{totals.cif_fc}</td>
                        <td/>
                        <td>{totals.cif_inr}</td>
                        <td/>
                        <td>{totals.fob_inr}</td>
                        <td/>
                        <td>{totals.amount}</td>
                        <td/>
                    </>)}
                </tr>
                </tfoot>
            </Table>

            <Button size="sm" onClick={addRow}>Add Row</Button>

            <hr/>
            <Button onClick={handleSave}>Save Trade</Button>
            {trade && <Button className="ms-2" variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>}
            {trade && mode === 'SALE' && <Button className="ms-2" onClick={handleGenerate}>Download PDF</Button>}
        </Form>
    );

    return isEditing ? <EditBlock/> : <ViewBlock/>;
};

export default TradeInvoiceCore;
