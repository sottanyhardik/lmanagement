// src/pages/License/LicenseList.jsx
import React, {lazy, Suspense, useEffect, useMemo, useState} from "react";
import {Badge, Card, Collapse, Container, Tab, Tabs} from "react-bootstrap";

import ListControls from "../../components/generic/ListControls";
import StatsBar from "../../components/generic/StatsBar";
import FilterChips from "../../components/generic/FilterChips";
import NewEntryCard from "../../components/generic/NewEntryCard";
import LoadMoreSection from "../../components/generic/LoadMoreSection";
import GroupedAccordion from "../../components/generic/GroupedAccordion";

import LicenseFilters from "./LicenseFilters";
import useLicenseListManager from "../../hooks/License/useLicenseListManager";
import {groupEntries} from "../../utils/groupEntries";
import {getLicenseNormLabel, licenseEntryTotals, licenseTotals,} from "../../utils/groupingHelpers";

const LicenseForm = lazy(() => import("./LicenseForm"));
const PurchaseTab = lazy(() => import("./PurchaseTab"));
const SaleTab = lazy(() => import("./SaleTab"));

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

export default function LicenseList() {
    const {
        entries, loading, hasMore,
        expanded, setExpanded,
        allExpanded, setAllExpanded,
        newEntry, setNewEntry,

        selectedIds, toggleSelect, toggleSelectAll,

        sortField, sortOrder, sortOptions, setSortField, setSortOrder,
        searchQuery, setSearchQuery, filters, setFilters, setPage,

        loadMoreRef, updateSingleEntry, fetchData, handleReset,
    } = useLicenseListManager();

    const [showNew, setShowNew] = useState(false);
    const onAddNewClick = () => {
        setNewEntry({});
        setShowNew(true);
    };

    // Exporter → Norm → Port
    const groups = useMemo(
        () =>
            groupEntries(entries, {
                getCompany: (e) => e?.exporter?.name ?? e?.exporter_name ?? "— Exporter —",
                getItem: getLicenseNormLabel,
                getPort: (e) => e?.port?.code ?? e?.port?.name ?? e?.port_code ?? e?.port_name ?? "— Port —",
            }),
        [entries]
    );

    const totalLoaded = entries.length;
    const groupCount = useMemo(
        () => (Array.isArray(groups) ? groups.length : Object.keys(groups || {}).length),
        [groups]
    );
    const selectedCount = selectedIds.length;

    useEffect(() => {
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

    // Headers
    const renderCompanyHeader = ({company}) => {
        const ports = company.items?.flatMap((it) => it.ports || []) ?? company.ports ?? [];
        const allEntries = ports.flatMap((p) => p.entries || []);
        const {fc, inr} = licenseTotals(allEntries);
        return (
            <div className="w-100">
                <div className="fw-bold fs-6 text-primary">🏢 {company.label}</div>
                <div className="ms-2 small text-muted">
                    CIF $: <span className="badge bg-info">{fmt2(fc)}</span> &nbsp;|&nbsp; INR ₹{" "}
                    <span className="badge bg-success ms-1">{fmt2(inr)}</span>
                </div>
            </div>
        );
    };

    const renderItemHeader = ({item}) => {
        const allEntries = (item.ports || []).flatMap((p) => p.entries || []);
        const {fc, inr} = licenseTotals(allEntries);
        const count = allEntries.length;
        return (
            <div className="d-flex align-items-center justify-content-between w-100">
                <div className="fw-semibold text-info">📦 Norm: {item.label}</div>
                <div className="text-muted small">
                    ({count} license{count !== 1 ? "s" : ""}) &nbsp;•&nbsp; CIF $:{" "}
                    <Badge bg="info">{fmt2(fc)}</Badge> &nbsp;•&nbsp; INR ₹{" "}
                    <Badge bg="success" className="ms-1">{fmt2(inr)}</Badge>
                </div>
            </div>
        );
    };

    const renderPortHeader = ({port, count}) => {
        const {fc, inr} = licenseTotals(port.entries || []);
        return (
            <div className="d-flex align-items-center justify-content-between w-100">
                <div className="fw-semibold">🛳 Port: {port.label}</div>
                <div className="text-muted small">
                    ({count} item{count > 1 ? "s" : ""}) &nbsp;•&nbsp; CIF $:{" "}
                    <Badge bg="info">{fmt2(fc)}</Badge> &nbsp;•&nbsp; INR ₹{" "}
                    <Badge bg="success" className="ms-1">{fmt2(inr)}</Badge>
                </div>
            </div>
        );
    };

    // Entry card
    const renderEntryCard = ({entry, expanded, toggleEntry}) => {
        const {fc, inr} = licenseEntryTotals(entry);
        return (
            <Card key={entry.id} className="mb-3 shadow-sm border border-secondary">
                <Card.Header className="bg-white border-bottom" onClick={toggleEntry} style={{cursor: "pointer"}}>
                    <div className="d-flex flex-wrap align-items-center justify-content-between">
                        <div className="d-flex flex-wrap align-items-center small text-nowrap">
                            <div className="me-3"><strong>License #:</strong> {entry.license_number || "-"}</div>
                            <div className="me-3"><strong>Date:</strong> {entry.license_date || "-"}</div>
                            <div className="me-3"><strong>Expiry:</strong> {entry.license_expiry_date || "-"}</div>
                        </div>
                        <div className="text-end">
                            <Badge bg="info" className="me-2">CIF $: {fmt2(fc)}</Badge>
                            <Badge bg="success">INR ₹ {fmt2(inr)}</Badge>
                            <Badge bg="danger" className="me-2">Balance $: {entry.get_balance_cif || "-"}</Badge>
                        </div>
                    </div>
                </Card.Header>

                <Collapse in={!!expanded[entry.id]} mountOnEnter unmountOnExit>
                    <Card.Body className="bg-white border-top-0">
                        <Tabs defaultActiveKey="view" className="mb-3" justify mountOnEnter unmountOnExit={false}>
                            <Tab eventKey="view" title="📄 View">
                                <div className="small">
                                    <div><strong>Exporter:</strong> {entry.exporter?.name || entry.exporter_name || "-"}
                                    </div>
                                    <div>
                                        <strong>Port:</strong> {entry.port?.name || entry.port?.code || entry.port_name || "-"}
                                    </div>
                                    <div><strong>Validity:</strong> {entry.license_expiry_date || "-"}</div>
                                </div>
                            </Tab>
                            <Tab eventKey="edit" title="✏️ Edit">
                                <Suspense fallback={<Fallback/>}>
                                    <LicenseForm entry={entry} onSaved={() => updateSingleEntry(entry.id)}/>
                                </Suspense>
                            </Tab>
                            <Tab eventKey="purchase" title="🧾 Purchase">
                                <Suspense fallback={<Fallback/>}>
                                    <PurchaseTab entry={entry} onSaved={() => updateSingleEntry(entry.id)}/>
                                </Suspense>
                            </Tab>
                            <Tab eventKey="sale" title="💸 Sale">
                                <Suspense fallback={<Fallback/>}>
                                    <SaleTab entry={entry} onSaved={() => updateSingleEntry(entry.id)}/>
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
                title="📜 Licenses"
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
                Filters={<LicenseFilters filters={filters} setFilters={setFilters}/>}
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
                    exporter_objs: "Exporter",
                    port_objs: "Port",
                    license_number: "License #",
                    from_date: "From",
                    to_date: "To"
                }}
            />

            {showNew && newEntry && (
                <Suspense fallback={<Fallback/>}>
                    <NewEntryCard
                        title="New License"
                        Editor={LicenseForm}
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
                renderItemHeader={renderItemHeader}
                renderPortHeader={renderPortHeader}
                renderEntryCard={renderEntryCard}
                emptyText="No licenses in this port."
            />

            <LoadMoreSection loading={loading} hasMore={hasMore} onManualLoadMore={() => setPage((p) => p + 1)}
                             loadMoreRef={loadMoreRef}/>

            {!loading && !entries.length && <div className="text-center text-muted my-4">No licenses found.</div>}
        </Container>
    );
}
