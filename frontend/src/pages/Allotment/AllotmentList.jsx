// src/pages/Allotment/AllotmentList.jsx
import React, {lazy, Suspense, useEffect, useMemo, useState} from 'react';
import {Accordion, Badge, Card, Collapse, Container, Tab, Tabs} from 'react-bootstrap';
import ListControls from '../../components/ListControls';
import AllotmentFilters from './AllotmentFilters';
import useAllotmentListManager from '../../hooks/Allotment/useAllotmentListManager';
import './AllotmentList.css';

// Lazy tabs & forms — chunks load only when first rendered
const AllotmentCreateForm = lazy(() => import('./forms/./AllotmentWizard'));
const AllotmentEditMainForm = lazy(() => import('./forms/AllotmentEditMainForm'));
const AllotmentMakeForm = lazy(() => import('./forms/AllotmentMakeForm'));
const AllotmentViewPane = lazy(() => import('./panels/AllotmentViewPane'));
const AllotmentTLTab = lazy(() => import('./panels/AllotmentTLTab'));

const Fallback = () => (
    <div className="py-3 text-center text-muted">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"/>
        Loading…
    </div>
);

const formatNumber = (val) => {
    if (val === null || val === undefined) return '-';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

const calcLineTotals = (lines = []) =>
    lines.reduce(
        (acc, it) => ({
            qty: acc.qty + (Number(it?.qty) || 0),
            fc: acc.fc + (Number(it?.cif_fc) || 0),
            inr: acc.inr + (Number(it?.cif_inr) || 0),
        }),
        {qty: 0, fc: 0, inr: 0}
    );

const AllotmentList = () => {
    const {
        entries,
        loading,
        sortField,
        sortOrder,
        sortOptions,
        setSortField,
        setSortOrder,
        searchQuery,
        setSearchQuery,
        setPage,
        filters,
        setFilters,
        handleReset,
        updateSingleEntry,
        fetchData,
        loadMoreRef,
    } = useAllotmentListManager();

    const [expanded, setExpanded] = useState({});           // per allotment id
    const [openCompanies, setOpenCompanies] = useState([]); // accordion keys
    const [activeTab, setActiveTab] = useState({});         // per allotment id
    const [newEntry, setNewEntry] = useState(null);

    const toggle = (id) => setExpanded((prev) => ({...prev, [id]: !prev[id]}));

    // ---------- Group: Company -> Product (product_name) -> Port Code ----------
    const groups = useMemo(() => {
        const byCompany = {};
        (entries || []).forEach((a) => {
            const companyName = a.company?.name || '— No Company —';
            const productName = a.product_name || a.item_name || '— No Product —';
            const portCode = a.port?.code || '— No Port —';

            if (!byCompany[companyName]) {
                byCompany[companyName] = {
                    products: {}, // product -> { ports, summary }
                    summary: {reqQty: 0, fc: 0, inr: 0},
                };
            }

            if (!byCompany[companyName].products[productName]) {
                byCompany[companyName].products[productName] = {
                    ports: {}, // portCode -> { entries, summary }
                    summary: {reqQty: 0, fc: 0, inr: 0},
                };
            }

            if (!byCompany[companyName].products[productName].ports[portCode]) {
                byCompany[companyName].products[productName].ports[portCode] = {
                    entries: [],
                    summary: {reqQty: 0, fc: 0, inr: 0},
                };
            }

            // push entry
            byCompany[companyName].products[productName].ports[portCode].entries.push(a);

            // roll-ups
            const t = calcLineTotals(a.allotment_details || []);
            const reqQty = Number(a.required_quantity || 0);

            byCompany[companyName].summary.reqQty += reqQty;
            byCompany[companyName].summary.fc += t.fc;
            byCompany[companyName].summary.inr += t.inr;

            byCompany[companyName].products[productName].summary.reqQty += reqQty;
            byCompany[companyName].products[productName].summary.fc += t.fc;
            byCompany[companyName].products[productName].summary.inr += t.inr;

            byCompany[companyName].products[productName].ports[portCode].summary.reqQty += reqQty;
            byCompany[companyName].products[productName].ports[portCode].summary.fc += t.fc;
            byCompany[companyName].products[productName].ports[portCode].summary.inr += t.inr;
        });
        return byCompany;
    }, [entries]);

    const sortedCompanies = useMemo(
        () => Object.keys(groups).sort((a, b) => a.localeCompare(b)),
        [groups]
    );

    // Expand all allotment cards by default when entries change
    useEffect(() => {
        const allOpen = {};
        (entries || []).forEach((e) => {
            allOpen[e.id] = true;
        });
        setExpanded(allOpen);
    }, [entries]);

    // Accordion event keys & open all companies by default
    const companyKeys = useMemo(() => sortedCompanies.map((_, idx) => `company-${idx}`), [sortedCompanies]);

    useEffect(() => {
        setOpenCompanies(companyKeys);
    }, [companyKeys]);

    const handleCompanyToggle = (ek) => {
        if (ek == null) return;
        setOpenCompanies((prev) => (prev.includes(ek) ? prev.filter((k) => k !== ek) : [...prev, ek]));
    };

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
                Filters={React.Children.toArray(<AllotmentFilters filters={filters} setFilters={setFilters}/>)}
                onAddNewClick={() =>
                    setNewEntry({
                        company: null,
                        port: null,
                        required_quantity: '',
                        unit_value_per_unit: '',
                        item_name: '',
                        contact_person: '',
                        contact_number: '',
                        invoice: '',
                        estimated_arrival_date: '',
                        bl_detail: '',
                        allotment_details: [{sr_number: null, qty: '', cif_fc: '', cif_inr: '', is_boe: false}],
                    })
                }
            />

            {newEntry && (
                <Card className="mb-3 border-success">
                    <Card.Header className="bg-success text-white">New Allotment</Card.Header>
                    <Card.Body>
                        <Suspense fallback={<Fallback/>}>
                            <AllotmentCreateForm
                                entry={newEntry}
                                isNew
                                onClose={() => setNewEntry(null)}
                                onSaved={() => {
                                    setNewEntry(null);
                                    fetchData();
                                }}
                            />
                        </Suspense>
                    </Card.Body>
                </Card>
            )}

            <Accordion alwaysOpen activeKey={openCompanies} onSelect={handleCompanyToggle}>
                {sortedCompanies.map((company, cIdx) => {
                    const {products, summary} = groups[company];
                    const sortedProducts = Object.keys(products).sort((a, b) => a.localeCompare(b));

                    return (
                        <Accordion.Item eventKey={`company-${cIdx}`} key={company}
                                        className="border border-primary mb-3">
                            <Accordion.Header className="bg-light text-primary">
                                <div className="w-100">
                                    <div className="fw-bold fs-5 text-primary">🏢 {company}</div>
                                    <div className="ms-2 small text-muted">
                                        Total Required Qty:{' '}
                                        <span className="badge bg-primary">{formatNumber(summary.reqQty)}</span> | CIF
                                        $:{' '}
                                        <span className="badge bg-info">{formatNumber(summary.fc)}</span> | INR ₹{' '}
                                        <span className="badge bg-success">{formatNumber(summary.inr)}</span>
                                    </div>
                                </div>
                            </Accordion.Header>

                            <Accordion.Body className="bg-white">
                                {sortedProducts.map((productName) => {
                                    const {ports, summary: pSum} = products[productName];
                                    const sortedPorts = Object.keys(ports).sort((a, b) => a.localeCompare(b));

                                    return (
                                        <div key={`${company}-${productName}`}
                                             className="mb-4 p-3 border rounded bg-light-subtle">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <div className="fw-semibold text-info">
                                                    📦 Product:&nbsp;<span className="text-dark">{productName}</span>
                                                </div>
                                                <div className="small text-muted">
                                                    Required Qty:{' '}
                                                    <span
                                                        className="badge bg-primary">{formatNumber(pSum.reqQty)}</span> |
                                                    CIF $:{' '}
                                                    <span className="badge bg-info">{formatNumber(pSum.fc)}</span> | INR
                                                    ₹{' '}
                                                    <span className="badge bg-success">{formatNumber(pSum.inr)}</span>
                                                </div>
                                            </div>

                                            {sortedPorts.map((portCode) => {
                                                const {entries: list, summary: portSum} = ports[portCode];

                                                return (
                                                    <div key={`${company}-${productName}-${portCode}`} className="mb-4">
                                                        <div
                                                            className="d-flex align-items-center justify-content-between mb-2">
                                                            <div className="fw-semibold">🛳 Port: {portCode}</div>
                                                            <div className="text-muted small">
                                                                ({list.length} allotment{list.length > 1 ? 's' : ''}) &nbsp;•&nbsp; Required
                                                                Qty:{' '}
                                                                <Badge
                                                                    bg="primary">{formatNumber(portSum.reqQty)}</Badge> &nbsp;•&nbsp; CIF
                                                                $:{' '}
                                                                <Badge
                                                                    bg="info">{formatNumber(portSum.fc)}</Badge> &nbsp;•&nbsp; INR
                                                                ₹{' '}
                                                                <Badge bg="success">{formatNumber(portSum.inr)}</Badge>
                                                            </div>
                                                        </div>

                                                        {list.map((a) => (
                                                            <Card key={a.id}
                                                                  className="mb-3 shadow-sm border border-secondary">
                                                                <Card.Header
                                                                    className="bg-white border-bottom"
                                                                    onClick={() => toggle(a.id)}
                                                                    style={{cursor: 'pointer'}}
                                                                >
                                                                    <div
                                                                        className="d-flex flex-wrap align-items-center justify-content-between">
                                                                        <div
                                                                            className="d-flex flex-wrap align-items-center small text-nowrap">
                                                                            <div className="me-3">
                                                                                <strong>Item:</strong> {a.item_name || '-'}
                                                                            </div>
                                                                            <div className="me-3">
                                                                                <strong>Invoice:</strong> {a.invoice || '-'}
                                                                            </div>
                                                                            <div className="me-3">
                                                                                <strong>ETA:</strong> {a.estimated_arrival_date || '-'}
                                                                            </div>
                                                                            <div className="me-3">
                                                                                <strong>BL:</strong> {a.bl_detail || '-'}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-end">
                                                                            <Badge
                                                                                bg={Number(a.balanced_quantity) > 0 ? 'warning' : 'success'}
                                                                                className="me-2"
                                                                            >
                                                                                Balance: {formatNumber(a.balanced_quantity)}
                                                                            </Badge>
                                                                            <Badge bg="info" className="me-2">
                                                                                Allotted
                                                                                Qty: {formatNumber(a.alloted_quantity)}
                                                                            </Badge>
                                                                            <Badge bg="secondary">
                                                                                Allotted
                                                                                $: {formatNumber(a.allotted_value)}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                </Card.Header>

                                                                <Collapse in={!!expanded[a.id]}>
                                                                    <Card.Body className="bg-white border-top-0">
                                                                        <Tabs
                                                                            activeKey={activeTab[a.id] || 'view'}
                                                                            onSelect={(k) =>
                                                                                setActiveTab((prev) => ({
                                                                                    ...prev,
                                                                                    [a.id]: k,
                                                                                }))
                                                                            }
                                                                            className="mb-3"
                                                                            justify
                                                                            mountOnEnter
                                                                            unmountOnExit={false}
                                                                        >
                                                                            <Tab eventKey="view" title="📄 View">
                                                                                <Suspense fallback={<Fallback/>}>
                                                                                    <AllotmentViewPane entry={a}/>
                                                                                </Suspense>
                                                                            </Tab>

                                                                            <Tab eventKey="edit" title="✏️ Edit Main">
                                                                                <Suspense fallback={<Fallback/>}>
                                                                                    <AllotmentEditMainForm
                                                                                        entry={a}
                                                                                        onSaved={() => updateSingleEntry(a.id)}
                                                                                    />
                                                                                </Suspense>
                                                                            </Tab>

                                                                            <Tab eventKey="make"
                                                                                 title="🧩 Make Allotment">
                                                                                <Suspense fallback={<Fallback/>}>
                                                                                    <AllotmentMakeForm
                                                                                        entry={a}
                                                                                        onSaved={() => updateSingleEntry(a.id)}
                                                                                    />
                                                                                </Suspense>
                                                                            </Tab>

                                                                            <Tab eventKey="tl" title="📑 Generate TL">
                                                                                <Suspense fallback={<Fallback/>}>
                                                                                    <AllotmentTLTab entry={a}/>
                                                                                </Suspense>
                                                                            </Tab>
                                                                        </Tabs>
                                                                    </Card.Body>
                                                                </Collapse>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </Accordion.Body>
                        </Accordion.Item>
                    );
                })}
            </Accordion>

            <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: '40px'}}>
                {loading && <div className="spinner-border text-primary" role="status"/>}
                {!loading && !entries.length && <span className="text-muted">No allotments found</span>}
            </div>
        </Container>
    );
};

export default AllotmentList;
