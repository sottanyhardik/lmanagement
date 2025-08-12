import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Col, Row} from "react-bootstrap";
import axios from "../../../../api/axiosInstance";
import {toast} from "react-toastify";

import {ADD_DETAIL_URL, DELETE_DETAIL_URL, LICENSE_SEARCH_URL} from "../api";
import AllottedHeader from "../AllottedHeader";
import AllottedItemsTable from "../AllottedItemsTable";
import SearchFilters from "../SearchFilters";
import SearchResultsTable from "../../components/SearchResultsTable";
import {fmt, round2, roundQty, safeNum} from "../utils/number";

const AllotmentLineItemTable = ({
                                    items,
                                    errors = {},
                                    onItemChange,      // not used after converting top rows to read-only; kept for compatibility
                                    onAddRow,          // (unused in this read-only top table)
                                    onRemoveRow,
                                    unitPrice = 0,
                                    requiredQuantity = 0,
                                    requiredValue,
                                    defaultItemName,
                                    allotmentId,
                                    onSaved,
                                }) => {
    const price = safeNum(unitPrice);

    // Remove-all state
    const [deletingAll, setDeletingAll] = useState(false);

    // ---- Current totals (top summary) ----
    const totals = useMemo(() => {
        let qty = 0, value = 0;
        (items || []).forEach((r) => {
            const q = roundQty(r.qty);
            qty += q;
            const rowVal = r.cif_fc != null && r.cif_fc !== "" ? safeNum(r.cif_fc) : q * price;
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
        license_number: "",
        sion_norm_id: "",
        sion_norm_label: "",
        description: defaultItemName || "",
        hs_code: "",
        notification_number: "",
        expired: "false",
        is_null: "false",
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
        const s = (v) => ((v ?? "") + "").trim();
        const p = {};
        if (s(srFilters.license_number)) p.license_number = s(srFilters.license_number);
        if (s(srFilters.sion_norm_id)) p.sion_norm_id = s(srFilters.sion_norm_id);
        if (s(srFilters.description)) p.description = s(srFilters.description);
        if (s(srFilters.hs_code)) p.hs_code = s(srFilters.hs_code);
        if (s(srFilters.notification_number)) p.notification_number = s(srFilters.notification_number);
        if (srFilters.expired !== "any") p.expired = srFilters.expired;
        if (srFilters.is_null !== "any") p.is_null = srFilters.is_null;
        p.min_balance_cif = Number(srFilters.min_balance_cif) || 0;
        p.min_balance_qty = Number(srFilters.min_balance_qty) || 0;
        p.page = page;
        p.page_size = pageSize;
        return p;
    }, [srFilters, page]);

// Compute max allotable qty (integer) with $10 tolerance on remaining budget,
// and a preference for remainingReqQty when it's > byRemainingValueQty and stock allows.
    const computeMaxAllotableQty = useCallback(
        (row) => {
            if (price <= 0) return 0;

            const TOL = 10; // $10 tolerance

            const availQty = roundQty(row.available_quantity);
            const availVal = safeNum(row.available_value);

            // Strict by license available $ (no tolerance so we don't exceed license cap)
            const byValueQty =
                Number.isFinite(availVal) && availVal > 0 ? roundQty(availVal / price) : Infinity;

            // Remaining budget with $10 tolerance
            const remainingValue = reqVal > 0 ? Math.max(0, reqVal - totals.value) : Infinity;
            const effectiveRemainingValue =
                Number.isFinite(remainingValue) ? remainingValue + TOL : Infinity;
            const byRemainingValueQty =
                Number.isFinite(effectiveRemainingValue) && effectiveRemainingValue > 0
                    ? roundQty(effectiveRemainingValue / price)
                    : Infinity;

            // Remaining required qty cap
            const remainingReqQty =
                roundQty(requiredQuantity) > 0
                    ? Math.max(0, roundQty(requiredQuantity) - totals.qty)
                    : Infinity;

            // Base candidate
            let q = availQty;
            if (Number.isFinite(byValueQty)) q = Math.min(q, byValueQty);
            if (Number.isFinite(byRemainingValueQty)) q = Math.min(q, byRemainingValueQty);
            if (Number.isFinite(remainingReqQty)) q = Math.min(q, remainingReqQty);

            // Your rule: if req-qty cap is larger than budget-qty cap and stock allows,
            // prefer remainingReqQty (but still respect license value and available qty).
            if (
                Number.isFinite(remainingReqQty) &&
                Number.isFinite(byRemainingValueQty) &&
                remainingReqQty > byRemainingValueQty &&
                availQty > remainingReqQty
            ) {
                q = Math.min(remainingReqQty, byValueQty, availQty);
            }

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

            // Prefill inputs with max allotable qty & derived $
            const map = {};
            list.forEach((r) => {
                let qty = "";
                let cif_fc = "";
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
            license_number: "",
            sion_norm_id: "",
            sion_norm_label: "",
            description: defaultItemName || "",
            hs_code: "",
            notification_number: "",
            expired: "false",
            is_null: "false",
            min_balance_cif: 500,
            min_balance_qty: 100,
        });
        setPage(1);
    };

// Allot one row (POST) with confirm
    const allotRow = async (resRow) => {
        if (!allotmentId) return toast.error("Missing allotmentId to create detail.");

        const id = resRow.id;
        const inpt = inputs[id] || {};
        let qty = roundQty(inpt.qty);
        let val = safeNum(inpt.cif_fc);

        const availQty = roundQty(resRow.available_quantity);
        const availVal = safeNum(resRow.available_value);

        // Derive missing side from price
        if (price > 0) {
            if (qty > 0 && (inpt.cif_fc === "" || val === 0)) val = round2(qty * price);
            else if (val > 0 && (inpt.qty === "" || qty === 0)) qty = roundQty(val / price);
        }

        if (qty <= 0 && val <= 0) return toast.warn("Enter Allot Qty or Allot $ (or both).");

        // Cap by available $ first
        if (Number.isFinite(availVal) && availVal > 0) {
            if (val > 0) val = Math.min(val, availVal);
            else if (price > 0 && qty > 0) val = Math.min(round2(qty * price), availVal);
        }

        // Recalc qty from value (floor) if we know price
        if (price > 0) {
            const qtyFromVal = roundQty(val / price);
            qty = qty > 0 ? Math.min(qty, qtyFromVal) : qtyFromVal;
        }

        // Cap by available qty
        if (Number.isFinite(availQty) && availQty > 0 && qty > availQty) {
            qty = availQty;
            if (price > 0) val = round2(qty * price);
            if (Number.isFinite(availVal) && availVal > 0) val = Math.min(val, availVal);
        }

        // ---- Skip remaining-budget cap iff license can already cover the request ----
        const licenseCoversRequest =
            (Number.isFinite(availQty) && availQty >= qty) &&
            (Number.isFinite(availVal) && availVal >= val);

        if (!licenseCoversRequest) {
            const remainingValue = reqVal > 0 ? Math.max(0, reqVal - totals.value) : Infinity;
            if (Number.isFinite(remainingValue) && val > remainingValue) {
                val = remainingValue;
                if (price > 0) qty = roundQty(val / price);
            }
        }

        // Always respect remaining required quantity
        const remainingReqQty =
            roundQty(requiredQuantity) > 0 ? Math.max(0, roundQty(requiredQuantity) - totals.qty) : Infinity;
        if (Number.isFinite(remainingReqQty) && qty > remainingReqQty) {
            qty = remainingReqQty;
            if (price > 0) val = round2(qty * price);
        }

        qty = roundQty(qty);
        val = round2(val);

        if (qty <= 0 || val <= 0) return toast.warn("Allotment after constraints is zero.");

        const confirmMsg = `Allot ${qty} units (${fmt(val)} $) from:\n\n${resRow.display_name}\n\nProceed?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setPosting((p) => ({...p, [id]: true}));
            await axios.post(ADD_DETAIL_URL(allotmentId), {
                item_id: resRow.id,
                qty,
                cif_fc: val,
                cif_inr: 0,
                is_boe: false,
            });
            toast.success("Allotted successfully");
            setInputs((prev) => ({...prev, [id]: {qty: "", cif_fc: ""}}));
            onSaved?.();
            fetchResults(); // refresh availability
        } catch (e) {
            const apiErrors = e.response?.data;
            if (apiErrors && typeof apiErrors === "object") {
                const first = Object.values(apiErrors)[0];
                toast.error(Array.isArray(first) ? first.join(", ") : String(first));
            } else {
                toast.error("Failed to allot. Please try again.");
            }
        } finally {
            setPosting((p) => ({...p, [id]: false}));
        }
    };

    // Delete one existing detail (DELETE)
    const removeDetail = async (row, index) => {
        if (!row?.id) {
            onRemoveRow?.(index);
            return;
        }
        const detailId = row.id;
        const url = row.delete_url || (allotmentId ? DELETE_DETAIL_URL(allotmentId, detailId) : null);
        if (!url) return toast.error("Delete URL not available.");
        if (!window.confirm("Remove this allotted line?")) return;

        try {
            setDeleting((d) => ({...d, [detailId]: true}));
            await axios.delete(url);
            toast.success("Allotment line removed");
            onRemoveRow?.(index);
            onSaved?.();
            fetchResults();
        } catch (e) {
            const apiErrors = e.response?.data;
            if (apiErrors && typeof apiErrors === "object") {
                const first = Object.values(apiErrors)[0];
                toast.error(Array.isArray(first) ? first.join(", ") : String(first));
            } else {
                toast.error("Failed to remove line. Please try again.");
            }
        } finally {
            setDeleting((d) => ({...d, [detailId]: false}));
        }
    };

    // Bulk remove all details
    const removeAllDetails = async () => {
        const rows = items || [];
        if (rows.length === 0) return;
        if (!window.confirm(`Remove all ${rows.length} allotted line(s)?`)) return;

        setDeletingAll(true);
        try {
            const saved = rows.map((row, idx) => ({row, idx})).filter(({row}) => !!row?.id);
            const unsavedIdx = rows
                .map((row, idx) => (!row?.id ? idx : null))
                .filter((v) => v !== null)
                .sort((a, b) => b - a);

            const requests = saved.map(({row}) => {
                const url = row.delete_url || (allotmentId ? DELETE_DETAIL_URL(allotmentId, row.id) : null);
                if (!url) return Promise.resolve({skipped: true});
                return axios.delete(url);
            });

            await Promise.allSettled(requests);

            // remove unsaved rows from UI
            unsavedIdx.forEach((idx) => onRemoveRow?.(idx));

            toast.success("Removed all allotted lines.");
            onSaved?.();
            fetchResults();
        } catch {
            toast.error("Failed to remove all lines. Some items may remain.");
        } finally {
            setDeletingAll(false);
        }
    };

    return (
        <>
            {/* Summary */}
            <div className="border rounded p-2 mb-2 bg-light">
                <Row className="g-2">
                    <Col md="auto" className="small"><strong>Required Qty:</strong> {roundQty(requiredQuantity)}</Col>
                    <Col md="auto" className="small"><strong>Allotted Qty:</strong> {totals.qty}</Col>
                    <Col md="auto" className="small"><strong>Balance Qty:</strong> {balance.qty}</Col>
                    <Col md="auto" className="small"><strong>Unit Price ($/unit):</strong> {fmt(unitPrice)}</Col>
                    <Col md="auto" className="small"><strong>Required $:</strong> ${fmt(reqVal)}</Col>
                    <Col md="auto" className="small"><strong>Allotted $:</strong> ${fmt(totals.value)}</Col>
                    <Col md="auto" className="small"><strong>Balance $:</strong> ${fmt(balance.value)}</Col>
                </Row>
            </div>

            {/* Allotted table + header */}
            <AllottedHeader
                itemsCount={(items || []).length}
                deletingAll={deletingAll}
                onRemoveAll={removeAllDetails}
            />
            <AllottedItemsTable items={items} deleting={deleting} onRemoveOne={removeDetail}/>

            {/* Filters */}
            <h6 className="mb-2">License Items Search</h6>
            <SearchFilters
                srFilters={srFilters}
                setFilter={setFilter}
                onSearch={fetchResults}
                onClear={clearFilters}
                loading={loading}
                count={count}
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                resultsLength={results.length}
            />

            {/* Search results */}
            <SearchResultsTable
                results={results}
                inputs={inputs}
                setInput={setInput}
                price={price}
                posting={posting}
                loading={loading}
                page={page}
                pageSize={pageSize}
                onAllotRow={allotRow}
            />
        </>
    );
};

export default AllotmentLineItemTable;
