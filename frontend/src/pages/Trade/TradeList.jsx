// src/pages/Trade/TradeList.jsx
import React, {lazy, Suspense, useEffect, useMemo, useState} from "react";
import {Badge, Card, Collapse, Container, Tab, Tabs} from "react-bootstrap";

import ListControls from "../../components/generic/ListControls";
import StatsBar from "../../components/generic/StatsBar";
import FilterChips from "../../components/generic/FilterChips";
import NewEntryCard from "../../components/generic/NewEntryCard";
import LoadMoreSection from "../../components/generic/LoadMoreSection";
import GroupedAccordion from "../../components/generic/GroupedAccordion";

import TradeFilters from "./TradeFilters";
import TradePaymentsTable from "./TradePaymentsTable";
import TotalsInline from "./components/TotalsInline";
import useTradeListManager from "../../hooks/Trade/useTradeListManager";
import {tradeEntryTotals, tradeTotals} from "./helpers/groupingHelpers";

// 👉 use the new unified core editor/viewer
const TradeInvoiceCore = lazy(() => import("../../components/trade/TradeInvoiceCore"));

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

export default function TradeList({initialFilters}) {
    const {
        entries,
        loading,
        hasMore,
        expanded,
        setExpanded,
        allExpanded,
        setAllExpanded,
        newEntry,
        setNewEntry,
        selectedIds,
        toggleSelect,
        toggleSelectAll,
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
        loadMoreRef,
        updateSingleEntry,
        fetchData,
        handleReset,
    } = useTradeListManager({initialFilters});

    const [showNew, setShowNew] = useState(false);
    const onAddNewClick = () => {
        setNewEntry({direction: "PURCHASE"}); // minimal seed; the core will start blank
        setShowNew(true);
    };

    // Group by: direction → counterparty → (SALE: BOE | PURCHASE: single hidden bucket)
    const groups = useMemo(() => {
        return (entries || []).reduce((acc, e) => {
            const direction = e?.direction || "— Direction —";
            const party =
                e?.direction === "PURCHASE"
                    ? e?.from_company?.name || "— Supplier —"
                    : e?.to_company?.name || "— Customer —";

            if (!acc[direction]) acc[direction] = {label: direction, items: {}};
            if (!acc[direction].items[party]) acc[direction].items[party] = {label: party, ports: {}};

            if (e?.direction === "SALE") {
                // Prefer BOE bill_of_entry_number if available
                const boeLabel =
                    e?.boe?.bill_of_entry_number ||
                    e?.boe?.boe_number ||
                    e?.boe_no ||
                    "-";
                if (!acc[direction].items[party].ports[boeLabel]) {
                    acc[direction].items[party].ports[boeLabel] = {
                        label: boeLabel,
                        direction: "SALE",
                        entries: [],
                    };
                }
                acc[direction].items[party].ports[boeLabel].entries.push(e);
            } else {
                // PURCHASE: keep in a hidden bucket (no BOE layer)
                const key = "__purchase_bucket__";
                if (!acc[direction].items[party].ports[key]) {
                    acc[direction].items[party].ports[key] = {
                        label: null,
                        direction: "PURCHASE",
                        entries: [],
                    };
                }
                acc[direction].items[party].ports[key].entries.push(e);
            }

            return acc;
        }, {});
    }, [entries]);

    const totalLoaded = entries.length;
    const groupCount = useMemo(() => Object.keys(groups || {}).length, [groups]);

    useEffect(() => {
        // expand all loaded entries by default
        const all = {};
        (entries || []).forEach((e) => {
            if (e?.id != null) all[e.id] = true;
        });
        setExpanded(all);
    }, [entries, setExpanded]);

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

    const renderCompanyHeader = ({company}) => {
        const allEntries = Object.values(company.ports || {}).flatMap((p) => p.entries || []);
        const {total, paid, due} = tradeTotals(allEntries);
        return (
            <div className="w-100">
                <div className="fw-bold fs-6 text-primary">{company.label}</div>
                <div className="ms-2 small text-muted">
                    Total ₹ <Badge bg="secondary">{fmt2(total)}</Badge> • Paid/Received ₹{" "}
                    <Badge bg="success">{fmt2(paid)}</Badge> • Due ₹ <Badge bg="danger">{fmt2(due)}</Badge>
                </div>
            </div>
        );
    };

    const renderItemHeader = ({item}) => {
        const allEntries = Object.values(item.ports || {}).flatMap((p) => p.entries || []);
        const {total, paid, due} = tradeTotals(allEntries);
        const count = allEntries.length;
        return (
            <div className="d-flex align-items-center justify-content-between w-100">
                <div className="fw-semibold">Counterparty: {item.label}</div>
                <div className="text-muted small">
                    ({count} trade{count !== 1 ? "s" : ""}) • Total ₹{" "}
                    <Badge bg="secondary">{fmt2(total)}</Badge> • Paid/Received ₹{" "}
                    <Badge bg="success">{fmt2(paid)}</Badge> • Due ₹ <Badge bg="danger">{fmt2(due)}</Badge>
                </div>
            </div>
        );
    };

    // PURCHASE: no "BOE:" header; SALE: show "BOE: <label>"
    const renderPortHeader = ({port, count}) => {
        const {total, paid, due} = tradeTotals(port.entries || []);

        if (port.direction !== "SALE") {
            return (
                <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="fw-semibold">Trades</div>
                    <div className="text-muted small">
                        ({count} item{count > 1 ? "s" : ""}) • Total ₹ <Badge bg="secondary">{fmt2(total)}</Badge>{" "}
                        • Paid/Received ₹ <Badge bg="success">{fmt2(paid)}</Badge> • Due ₹{" "}
                        <Badge bg="danger">{fmt2(due)}</Badge>
                    </div>
                </div>
            );
        }

        return (
            <div className="d-flex align-items-center justify-content-between w-100">
                <div className="fw-semibold">BOE: {port.label || "-"}</div>
                <div className="text-muted small">
                    ({count} item{count > 1 ? "s" : ""}) • Total ₹ <Badge bg="secondary">{fmt2(total)}</Badge>{" "}
                    • Paid/Received ₹ <Badge bg="success">{fmt2(paid)}</Badge> • Due ₹{" "}
                    <Badge bg="danger">{fmt2(due)}</Badge>
                </div>
            </div>
        );
    };

    const renderEntryCard = ({entry, expanded, toggleEntry}) => {
        const {total, paid, due} = tradeEntryTotals(entry);
        return (
            <Card key={entry.id} className="mb-3 shadow-sm border border-secondary">
                <Card.Header className="bg-white border-bottom" onClick={toggleEntry} style={{cursor: "pointer"}}>
                    <div className="d-flex flex-wrap align-items-center justify-content-between">
                        <div className="d-flex flex-wrap align-items-center small text-nowrap">
                            <div className="me-3">
                                <strong>Invoice #:</strong> {entry.invoice_number || "-"}
                            </div>
                            <div className="me-3">
                                <strong>Date:</strong> {entry.invoice_date || "-"}
                            </div>
                            <div className="me-3">
                                <strong>Direction:</strong> {entry.direction}
                            </div>
                        </div>
                        <div className="text-end">
                            <Badge bg="secondary" className="me-2">
                                Total ₹ {fmt2(total)}
                            </Badge>
                            <Badge bg="success" className="me-2">
                                Settled ₹ {fmt2(paid)}
                            </Badge>
                            <Badge bg="danger">Due ₹ {fmt2(due)}</Badge>
                        </div>
                    </div>
                </Card.Header>

                <Collapse in={!!expanded[entry.id]} mountOnEnter unmountOnExit>
                    <Card.Body className="bg-white border-top-0">
                        <Tabs defaultActiveKey="trade" className="mb-3" justify mountOnEnter unmountOnExit={false}>
                            <Tab eventKey="trade" title="📄 Trade">
                                <Suspense fallback={<Fallback/>}>
                                    <TradeInvoiceCore
                                        mode={entry.direction}
                                        boe={entry.boe || null}
                                        initialTrade={entry}
                                        fetchByBoe={entry.direction === "SALE"}
                                        onSaved={() => updateSingleEntry(entry.id)}
                                    />
                                </Suspense>
                            </Tab>

                            <Tab eventKey="payments" title="💸 Payments">
                                <TradePaymentsTable
                                    tradeId={entry.id}
                                    rows={entry.payments || []}
                                    onAfterServerChange={() => updateSingleEntry(entry.id)}
                                />
                            </Tab>

                            <Tab eventKey="totals" title="🧮 Totals">
                                <TotalsInline entry={entry}/>
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
                title="💼 Trades"
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
                Filters={<TradeFilters filters={filters} setFilters={setFilters}/>}
                onAddNewClick={onAddNewClick}
            />

            <StatsBar
                totalLoaded={entries.length}
                groupCount={groupCount}
                selectedCount={selectedIds.length}
                allExpanded={allExpanded}
                onToggleExpand={handleToggleExpandAll}
            />

            <FilterChips
                filters={filters}
                setFilters={setFilters}
                onClearAll={handleReset}
                labels={{
                    direction: "Direction",
                    company_objs: "Company",
                    boe: "BOE",
                    date_from: "From",
                    date_to: "To",
                    invoice_number: "Invoice #",
                    has_due: "Has Due",
                }}
            />

            {showNew && newEntry && (
                <Suspense fallback={<Fallback/>}>
                    <NewEntryCard
                        title="New Trade"
                        Editor={TradeInvoiceCore}
                        editorProps={{
                            mode: newEntry.direction || "PURCHASE",
                            boe: null,
                            initialTrade: null,
                            fetchByBoe: false,
                        }}
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
                selection={
                    Array.isArray(selectedIds) ? {selectedIds, toggleSelect, toggleSelectAll} : null
                }
                renderCompanyHeader={renderCompanyHeader}
                renderItemHeader={renderItemHeader}
                renderPortHeader={renderPortHeader}
                renderEntryCard={renderEntryCard}
                emptyText="No trades found."
            />

            <LoadMoreSection
                loading={loading}
                hasMore={hasMore}
                onManualLoadMore={() => setPage((p) => p + 1)}
                loadMoreRef={loadMoreRef}
            />

            {!loading && !entries.length && (
                <div className="text-center text-muted my-4">No trades found.</div>
            )}
        </Container>
    );
}
