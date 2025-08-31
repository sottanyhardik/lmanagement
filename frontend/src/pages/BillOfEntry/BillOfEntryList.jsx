// src/pages/BillOfEntry/BillOfEntryList.jsx
import React, {lazy, Suspense, useEffect, useMemo, useState} from "react";
import {Badge, Card, Col, Collapse, Container, Form, Row, Tab, Table, Tabs} from "react-bootstrap";

// generic building blocks
import ListControls from "../../components/generic/ListControls";
import StatsBar from "../../components/generic/StatsBar";
import FilterChips from "../../components/generic/FilterChips";
import NewEntryCard from "../../components/generic/NewEntryCard";
import LoadMoreSection from "../../components/generic/LoadMoreSection";
import GroupedAccordion from "../../components/generic/GroupedAccordion";

// local BOE bits
import BoeFilters from "./BoeFilters";
import DeleteSelectedButton from "./DeleteSelectedButton";

// data helpers
import {groupEntries} from "../../utils/groupEntries";
import useBillOfEntryListManager from "../../hooks/BillOfEntry/useBillOfEntryListManager";

// lazies
const BillOfEntryForm = lazy(() => import("./BillOfEntryForm"));
const TransferLetterForm = lazy(() => import("./TransferLetterForm"));
const InvoiceForm = lazy(() => import("./InvoiceForm"));

const Fallback = () => (
    <div className="py-3 text-center text-muted">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"/>
        Loading…
    </div>
);

const fmt2 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.00";
    return n.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

const sumLines = (lines = []) =>
    (lines || []).reduce(
        (acc, it) => {
            acc.qty += Number(it?.qty ?? 0) || 0;
            acc.fc += Number(it?.cif_fc ?? 0) || 0;
            acc.inr += Number(it?.cif_inr ?? 0) || 0;
            return acc;
        },
        {qty: 0, fc: 0, inr: 0}
    );

// Prefer summaries when present; otherwise fallback to summing entries’ lines
const sumFromPorts = (ports = []) =>
    (ports || []).reduce(
        (acc, p) => {
            const s = p?.summary || {qty: 0, fc: 0, inr: 0};
            return {qty: acc.qty + (s.qty || 0), fc: acc.fc + (s.fc || 0), inr: acc.inr + (s.inr || 0)};
        },
        {qty: 0, fc: 0, inr: 0}
    );

export default function BillOfEntryList() {
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

        // selection
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        clearSelection,

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
        handleExportXLSX,
        handleExportPDF,
    } = useBillOfEntryListManager();

    // Show create form only after “+ Add New”
    const [showNew, setShowNew] = useState(false);

    const makeDraft = () => ({
        bill_of_entry_number: "",
        bill_of_entry_date: "",
        port: null,
        exchange_rate: "",
        company: null,
        invoice_no: "",
        product_name: "",
        item_details: [{sr_number: "", transaction_type: "D", qty: "", cif_fc: "", cif_inr: ""}],
    });

    const onAddNewClick = () => {
        setNewEntry(makeDraft());
        setShowNew(true);
    };

    const onSavedRow = (id) => {
        if (!id) return;
        updateSingleEntry(id);
        setExpanded((prev) => ({...prev, [id]: true}));
    };

    // Company → Item → Port grouping with correct BOE totals from item_details
    const groups = useMemo(
        () =>
            groupEntries(entries, {
                getCompany: (e) => e?.company?.name ?? e?.company_name ?? "— Company —",
                getItem: (e) => e?.product_name ?? e?.item_name ?? "— Item —",
                getPort: (e) => e?.port?.code ?? e?.port?.name ?? e?.port_code ?? e?.port_name ?? "— Port —",
                getQty: (e) => sumLines(e?.item_details).qty,
                getFc: (e) => sumLines(e?.item_details).fc,
                getInr: (e) => sumLines(e?.item_details).inr,
            }),
        [entries]
    );

    const totalLoaded = entries.length;
    const groupCount = useMemo(() => Object.keys(groups || {}).length, [groups]);
    const selectedCount = selectedIds.length;

    // Expand default: open all rows when entries change
    useEffect(() => {
        const next = {};
        (entries || []).forEach((e) => (next[e.id] = true));
        setExpanded(next);
    }, [entries, setExpanded]);

    // True Expand/Collapse All: update map in bulk
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

    // keep active tab per-entry in the list
    const [activeTabByEntry, setActiveTabByEntry] = useState({});

    // ── headers (use summaries) ───────────────────────────────────────────────────
    const renderCompanyHeader = ({company}) => {
        // company.items -> [{label, ports:[{summary}]}] OR company.ports
        const ports = company.items ? company.items.flatMap((it) => it.ports || []) : company.ports || [];
        const s = sumFromPorts(ports);

        return (
            <div className="w-100">
                <div className="fw-bold fs-6 text-primary">🏢 {company.label}</div>
                <div className="ms-2 small text-muted">
                    Qty: <span className="badge bg-primary">{fmt2(s.qty)}</span> &nbsp;|&nbsp; CIF $:
                    <span className="badge bg-info ms-1">{fmt2(s.fc)}</span> &nbsp;|&nbsp; INR ₹
                    <span className="badge bg-success ms-1">{fmt2(s.inr)}</span>
                </div>
            </div>
        );
    };

    const renderItemHeader = ({item}) => {
        const s = sumFromPorts(item.ports || []);
        return (
            <div className="fw-semibold text-info">
                🧩 {item.label} &nbsp;—&nbsp; Qty: <Badge bg="primary">{fmt2(s.qty)}</Badge> &nbsp;|&nbsp; CIF $:
                <Badge bg="info" className="ms-1">{fmt2(s.fc)}</Badge> &nbsp;|&nbsp; INR ₹
                <Badge bg="success" className="ms-1">{fmt2(s.inr)}</Badge>
            </div>
        );
    };

    const renderPortHeader = ({port, count}) => {
        const s = port.summary || {qty: 0, fc: 0, inr: 0};
        return (
            <div className="d-flex align-items-center justify-content-between w-100">
                <div className="fw-semibold">🌐 Port: {port.label}</div>
                <div className="text-muted small">
                    ({count} item{count > 1 ? "s" : ""}) &nbsp;•&nbsp; Qty:
                    <Badge bg="primary" className="ms-1">{fmt2(s.qty)}</Badge> &nbsp;•&nbsp; CIF $:
                    <Badge bg="info" className="ms-1">{fmt2(s.fc)}</Badge> &nbsp;•&nbsp; INR ₹
                    <Badge bg="success" className="ms-1">{fmt2(s.inr)}</Badge>
                </div>
            </div>
        );
    };

    // ── entry card (BOE) ──────────────────────────────────────────────────────────
    const renderEntryCard = ({entry, expanded, toggleEntry, selection}) => {
        const lineTotals = sumLines(entry?.item_details);
        const isChecked = Array.isArray(selection?.selectedIds)
            ? selection.selectedIds.includes(entry.id)
            : false;

        return (
            <Card key={entry.id} className="mb-3 shadow-sm border border-secondary">
                <Card.Header className="bg-white border-bottom">
                    <div className="d-flex align-items-center">
                        {/* row checkbox */}
                        {selection && (
                            <Form.Check
                                type="checkbox"
                                className="me-2"
                                checked={isChecked}
                                onChange={() => selection?.toggleSelect?.(entry.id)}
                            />
                        )}

                        {/* clickable summary to expand/collapse */}
                        <div onClick={toggleEntry} style={{cursor: "pointer", flex: 1}}>
                            <Row className="gx-3 flex-nowrap overflow-auto align-items-center small text-nowrap">
                                <Col xs="auto" className="flex-shrink-0">
                                    <strong className="text-primary">BOE #{entry.bill_of_entry_number || "-"}</strong>
                                </Col>
                                <Col xs="auto" className="flex-shrink-0">Date: {entry.bill_of_entry_date || "-"}</Col>
                                <Col xs="auto" className="flex-shrink-0">
                                    Port: {entry?.port?.code || entry?.port?.name || "-"}
                                </Col>
                                <Col xs="auto" className="flex-shrink-0">Invoice: {entry.invoice_no || "-"}</Col>
                                <Col xs="auto" className="flex-shrink-0">Qty: <Badge
                                    bg="primary">{fmt2(lineTotals.qty)}</Badge></Col>
                                <Col xs="auto" className="flex-shrink-0">CIF $: <Badge
                                    bg="info">{fmt2(lineTotals.fc)}</Badge></Col>
                                <Col xs="auto" className="flex-shrink-0">Exc Rt: {fmt2(entry.exchange_rate)}</Col>
                                <Col xs="auto" className="flex-shrink-0">INR ₹ <Badge
                                    bg="success">{fmt2(lineTotals.inr)}</Badge></Col>
                            </Row>
                        </div>
                    </div>
                </Card.Header>

                <Collapse in={!!expanded[entry.id]} mountOnEnter unmountOnExit>
                    <Card.Body className="bg-white border-top-0">
                        <Tabs
                            activeKey={activeTabByEntry[entry.id] || "view"}
                            onSelect={(k) => setActiveTabByEntry((prev) => ({...prev, [entry.id]: k || "view"}))}
                            className="mb-3"
                            justify
                        >
                            <Tab eventKey="view" title="📄 View">
                                <Table striped bordered hover responsive size="sm" className="mt-2">
                                    <thead className="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>SR No</th>
                                        <th className="text-end">Qty</th>
                                        <th className="text-end">CIF FC</th>
                                        <th className="text-end">CIF INR</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {(entry.item_details || []).map((it, idx) => (
                                        <tr
                                            key={idx}
                                            className={
                                                !it?.sr_number || !it?.qty || Number(it.qty) <= 0 ? "table-danger" : ""
                                            }
                                        >
                                            <td>{idx + 1}</td>
                                            <td>{it?.sr_number?.display_name ?? it?.sr_number ?? "-"}</td>
                                            <td className="text-end">{fmt2(it?.qty)}</td>
                                            <td className="text-end">{fmt2(it?.cif_fc)}</td>
                                            <td className="text-end">{fmt2(it?.cif_inr)}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                    <tfoot>
                                    <tr className="table-light fw-bold">
                                        <td colSpan={2}>Total</td>
                                        <td className="text-end">{fmt2(lineTotals.qty)}</td>
                                        <td className="text-end">{fmt2(lineTotals.fc)}</td>
                                        <td className="text-end">{fmt2(lineTotals.inr)}</td>
                                    </tr>
                                    </tfoot>
                                </Table>
                            </Tab>

                            <Tab eventKey="edit" title="✏️ Edit">
                                <Suspense fallback={<Fallback/>}>
                                    <BillOfEntryForm
                                        entry={entry}
                                        onSaved={() => {
                                            updateSingleEntry(entry.id);
                                            setActiveTabByEntry((p) => ({...p, [entry.id]: "view"}));
                                        }}
                                    />
                                </Suspense>
                            </Tab>

                            <Tab eventKey="transfer_letter" title="📑 Generate TL">
                                <Suspense fallback={<Fallback/>}>
                                    <TransferLetterForm boe={entry} autoDownload/>
                                </Suspense>
                            </Tab>

                            <Tab eventKey="invoice" title="🧾 Generate Invoice">
                                <Suspense fallback={<Fallback/>}>
                                    <InvoiceForm
                                        boe={entry}
                                        onSaved={() => {
                                            updateSingleEntry(entry.id);
                                        }}
                                    />
                                </Suspense>
                            </Tab>
                        </Tabs>
                    </Card.Body>
                </Collapse>
            </Card>
        );
    };

    return (
        <Container className="mt-4">
            <ListControls
                title="📄 Bill of Entry"
                search={searchQuery}
                setSearch={setSearchQuery}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={setSortField}
                setSortOrder={setSortOrder}
                sortOptions={sortOptions}
                setPage={setPage}
                handleReset={handleReset}
                handleExportCSV={loading ? undefined : handleExportXLSX}
                handleExportPDF={loading ? undefined : handleExportPDF}
                dataExport
                Filters={<BoeFilters filters={filters} setFilters={setFilters}/>}
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
                    product_name: "Product",
                    item_name: "Item",
                    license_number: "License #",
                    hs_code: "HS Code",
                    has_balance: "Has Balance",
                    include_assigned: "With BOE",
                    date_from: "From",
                    date_to: "To",
                }}
            />

            <DeleteSelectedButton
                selectedIds={selectedIds}
                onDeleted={() => {
                    clearSelection();
                    fetchData(false, 1);
                }}
            />

            {/* Show the create form ONLY when user clicks Add New */}
            {showNew && newEntry && (
                <Suspense fallback={<Fallback/>}>
                    <NewEntryCard
                        title="New Bill of Entry"
                        Editor={BillOfEntryForm}
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
                selection={{selectedIds, toggleSelect, toggleSelectAll}}
                renderCompanyHeader={renderCompanyHeader}
                renderItemHeader={renderItemHeader}
                renderPortHeader={renderPortHeader}
                renderEntryCard={renderEntryCard}
                emptyText="No entries in this port."
            />

            <LoadMoreSection
                loading={loading}
                hasMore={hasMore}
                onManualLoadMore={() => setPage((p) => p + 1)}
                loadMoreRef={loadMoreRef}
            />

            {!loading && !entries.length && (
                <div className="text-center text-muted my-4">No entries found.</div>
            )}
        </Container>
    );
}
