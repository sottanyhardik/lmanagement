// src/pages/Allotment/AllotmentList.jsx
import React, {lazy, Suspense, useEffect, useMemo, useState} from "react";
import {Badge, Card, Collapse, Container, Tab, Tabs} from "react-bootstrap";

// generic building blocks
import ListControls from "../../components/generic/ListControls";
import StatsBar from "../../components/generic/StatsBar";
import FilterChips from "../../components/generic/FilterChips";
import NewEntryCard from "../../components/generic/NewEntryCard";
import LoadMoreSection from "../../components/generic/LoadMoreSection";
import GroupedAccordion from "../../components/generic/GroupedAccordion";

import AllotmentFilters from "./AllotmentFilters";
import useAllotmentListManager from "../../hooks/Allotment/useAllotmentListManager";
import {groupEntries} from "../../utils/groupEntries";
import "./AllotmentList.css";

// lazy forms/panels
const AllotmentCreateForm = lazy(() => import("./forms/AllotmentWizard"));
const AllotmentForm = lazy(() => import("./forms/AllotmentForm"));
const AllotmentMakeForm = lazy(() => import("./forms/AllotmentMakeForm"));
const AllotmentViewPane = lazy(() => import("./panels/AllotmentViewPane"));
const AllotmentTLTab = lazy(() => import("./panels/AllotmentTLTab"));

const Fallback = () => (
    <div className="py-3 text-center text-muted">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"/>
        Loading…
    </div>
);

const fmt2 = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return "-";
    return n.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

// Sum a list of detail lines (qty, cif_fc, cif_inr)
const sumLines = (lines = []) =>
    lines.reduce(
        (acc, it) => ({
            qty: acc.qty + (Number(it?.qty) || 0),
            fc: acc.fc + (Number(it?.cif_fc) || 0),
            inr: acc.inr + (Number(it?.cif_inr) || 0),
        }),
        {qty: 0, fc: 0, inr: 0}
    );

export default function AllotmentList() {
    const {
        // data/state
        entries,
        loading,
        hasMore,
        expanded,
        setExpanded,
        allExpanded,
        setAllExpanded,
        newEntry,
        setNewEntry,

        // selection (optional)
        selectedIds,
        toggleSelect,
        toggleSelectAll,

        // sorting/search/filtering
        sortField,
        sortOrder,
        sortOptions,
        setSortField,
        setSortOrder,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        setPage,

        // io
        loadMoreRef,
        updateSingleEntry,
        fetchData,
        handleReset,
    } = useAllotmentListManager();

    // keep the add form hidden until user clicks “Add New”
    const [showNew, setShowNew] = useState(false);

    // build a default draft only when we actually open the form
    const makeDefaultDraft = () => ({
        company: null,
        port: null,
        required_quantity: "",
        unit_value_per_unit: "",
        item_name: "",
        contact_person: "",
        contact_number: "",
        invoice: "",
        estimated_arrival_date: "",
        bl_detail: "",
        allotment_details: [{sr_number: null, qty: "", cif_fc: "", cif_inr: "", is_boe: false}],
    });

    const onAddNewClick = () => {
        setNewEntry(makeDefaultDraft());
        setShowNew(true);
    };

    const onSavedRow = (id) => {
        if (!id) return;
        updateSingleEntry(id);
        setExpanded((prev) => ({...prev, [id]: true}));
    };

    // Company → Item/Product → Port grouping
    const groups = useMemo(
        () =>
            groupEntries(entries, {
                getCompany: (e) => e?.company?.name ?? "— No Company —",
                getItem: (e) => e?.product_name ?? e?.item_name ?? "— No Product —",
                getPort: (e) => e?.port?.code ?? e?.port?.name ?? "— No Port —",
                // For totals we want the *sum of detail lines* (qty/fc/inr)
                getQty: (e) => Number(e?.required_quantity ?? 0),
                getFc: (e) => sumLines(e?.allotment_details).fc,
                getInr: (e) => sumLines(e?.allotment_details).inr,
            }),
        [entries]
    );

    const totalLoaded = entries.length;
    const groupCount = useMemo(() => Object.keys(groups || {}).length, [groups]);
    const selectedCount = Array.isArray(selectedIds) ? selectedIds.length : 0;

    // expand everything by default when entries change
    useEffect(() => {
        const next = {};
        (entries || []).forEach((e) => (next[e.id] = true));
        setExpanded(next);
    }, [entries, setExpanded]);

    // Expand/Collapse ALL: update both the boolean and the map
    const handleToggleExpandAll = () => {
        const nextOpen = !allExpanded;
        setAllExpanded(nextOpen);
        setExpanded((prev) => {
            const next = {...prev};
            (entries || []).forEach((e) => {
                if (e?.id != null) next[e.id] = nextOpen;
            });
            return next;
        });
    };

    // ---- Custom headers so exporter/port totals come from detail lines ----
    const renderCompanyHeader = ({company}) => {
        // collect all entries under this company
        const ports = company.items?.flatMap((it) => it.ports || []) ?? company.ports ?? [];
        const allEntries = ports.flatMap((p) => p.entries || []);
        const totals = allEntries.reduce(
            (acc, en) => {
                const t = sumLines(en?.allotment_details);
                acc.qty += t.qty;
                acc.fc += t.fc;
                acc.inr += t.inr;
                return acc;
            },
            {qty: 0, fc: 0, inr: 0}
        );

        return (
            <div className="w-100">
                <div className="fw-bold fs-6 text-primary">🏢 {company.label}</div>
                <div className="ms-2 small text-muted">
                    Qty: <span className="badge bg-primary">{fmt2(totals.qty)}</span> &nbsp;|&nbsp;
                    CIF $: <span className="badge bg-info">{fmt2(totals.fc)}</span> &nbsp;|&nbsp;
                    INR ₹ <span className="badge bg-success ms-1">{fmt2(totals.inr)}</span>
                </div>
            </div>
        );
    };

    const renderPortHeader = ({port, count}) => {
        const totals = (port.entries || []).reduce(
            (acc, en) => {
                const t = sumLines(en?.allotment_details);
                acc.qty += t.qty;
                acc.fc += t.fc;
                acc.inr += t.inr;
                return acc;
            },
            {qty: 0, fc: 0, inr: 0}
        );

        return (
            <div className="d-flex align-items-center justify-content-between w-100">
                <div className="fw-semibold">🛳 Port: {port.label}</div>
                <div className="text-muted small">
                    ({count} item{count > 1 ? "s" : ""}) &nbsp;•&nbsp;
                    Qty: <Badge bg="primary">{fmt2(totals.qty)}</Badge> &nbsp;•&nbsp;
                    CIF $: <Badge bg="info" className="ms-1">{fmt2(totals.fc)}</Badge> &nbsp;•&nbsp;
                    INR ₹ <Badge bg="success" className="ms-1">{fmt2(totals.inr)}</Badge>
                </div>
            </div>
        );
    };

    // ---- Entry card (collapse bound to expanded[entry.id]) ----
    const renderEntryCard = ({entry, expanded, toggleEntry}) => (
        <Card key={entry.id} className="mb-3 shadow-sm border border-secondary">
            <Card.Header className="bg-white border-bottom" onClick={toggleEntry} style={{cursor: "pointer"}}>
                <div className="d-flex flex-wrap align-items-center justify-content-between">
                    <div className="d-flex flex-wrap align-items-center small text-nowrap">
                        <div className="me-3">
                            <strong>Item:</strong> {entry.item_name || "-"}
                        </div>
                        <div className="me-3">
                            <strong>Invoice:</strong> {entry.invoice || "-"}
                        </div>
                        <div className="me-3">
                            <strong>ETA:</strong> {entry.estimated_arrival_date || "-"}
                        </div>
                        <div className="me-3">
                            <strong>BL:</strong> {entry.bl_detail || "-"}
                        </div>
                    </div>
                    <div className="text-end">
                        <Badge bg={Number(entry.balanced_quantity) > 0 ? "warning" : "success"} className="me-2">
                            Balance: {fmt2(entry.balanced_quantity)}
                        </Badge>
                        <Badge bg="info" className="me-2">
                            Allotted Qty: {fmt2(entry.alloted_quantity)}
                        </Badge>
                        <Badge bg="secondary">Allotted $: {fmt2(entry.allotted_value)}</Badge>
                    </div>
                </div>
            </Card.Header>

            <Collapse in={!!expanded[entry.id]} mountOnEnter unmountOnExit>
                <Card.Body className="bg-white border-top-0">
                    <Tabs defaultActiveKey="view" className="mb-3" justify mountOnEnter unmountOnExit={false}>
                        <Tab eventKey="view" title="📄 View">
                            <Suspense fallback={<Fallback/>}>
                                <AllotmentViewPane entry={entry}/>
                            </Suspense>
                        </Tab>
                        <Tab eventKey="edit" title="✏️ Edit Main">
                            <Suspense fallback={<Fallback/>}>
                                <AllotmentForm
                                    mode="edit"
                                    entry={entry}
                                    onSaved={() => updateSingleEntry(entry.id)}
                                />
                            </Suspense>
                        </Tab>
                        <Tab eventKey="make" title="🧩 Make Allotment">
                            <Suspense fallback={<Fallback/>}>
                                <AllotmentMakeForm entry={entry} onSaved={() => updateSingleEntry(entry.id)}/>
                            </Suspense>
                        </Tab>
                        <Tab eventKey="tl" title="📑 Generate TL">
                            <Suspense fallback={<Fallback/>}>
                                <AllotmentTLTab entry={entry}/>
                            </Suspense>
                        </Tab>
                    </Tabs>
                </Card.Body>
            </Collapse>
        </Card>
    );

    return (
        <Container className="mt-4">
            <ListControls
                title="📦 Allotments"
                search={searchQuery}
                setSearch={setSearchQuery}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={setSortField}
                setSortOrder={setSortOrder}
                sortOptions={sortOptions}
                setPage={setPage}
                handleReset={handleReset}
                dataExport={false}
                Filters={<AllotmentFilters filters={filters} setFilters={setFilters}/>}
                onAddNewClick={onAddNewClick}
            />

            <StatsBar
                totalLoaded={totalLoaded}
                groupCount={groupCount}
                selectedCount={selectedCount}
                allExpanded={allExpanded}
                onToggleExpand={handleToggleExpandAll}
            />

            <FilterChips
                filters={filters}
                setFilters={setFilters}
                onClearAll={handleReset}
                labels={{
                    company_objs: "Company (Incl.)",
                    exclude_company_objs: "Company (Excl.)",
                    port_objs: "Port (Incl.)",
                    exclude_port_objs: "Port (Excl.)",
                    related_company: "Related Company",
                    exporter: "Exporter",
                    item_name: "Item",
                    license_number: "License #",
                    hs_code: "HS Code",
                    has_balance: "Has Balance",
                    include_assigned: "With BOE",
                    date_from: "From",
                    date_to: "To",
                }}
            />

            {/* Show the create form ONLY when user clicks Add New */}
            {showNew && newEntry && (
                <Suspense fallback={<Fallback/>}>
                    <NewEntryCard
                        title="New Allotment"
                        Editor={AllotmentCreateForm}
                        editorProps={{entry: newEntry}}
                        onClose={() => {
                            setShowNew(false);
                            setNewEntry(null);
                        }}
                        onSaved={() => {
                            setShowNew(false);
                            setNewEntry(null);
                            fetchData(false, 1);
                        }}
                    />
                </Suspense>
            )}

            <GroupedAccordion
                groups={groups}
                allExpanded={false}
                expanded={expanded}
                toggle={(id) => setExpanded((prev) => ({...prev, [id]: !prev[id]}))}
                selection={Array.isArray(selectedIds) ? {selectedIds, toggleSelect, toggleSelectAll} : null}
                renderCompanyHeader={renderCompanyHeader}
                renderPortHeader={renderPortHeader}
                renderEntryCard={renderEntryCard}
                emptyText="No allotments in this port."
            />

            <LoadMoreSection
                loading={loading}
                hasMore={hasMore}
                onManualLoadMore={() => setPage((p) => p + 1)}
                loadMoreRef={loadMoreRef}
            />

            {!loading && !entries.length && (
                <div className="text-center text-muted my-4">No allotments found.</div>
            )}
        </Container>
    );
}
