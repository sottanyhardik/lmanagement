import React, {useCallback, useEffect, useMemo, useState} from 'react';
import axios from '../../api/axiosInstance';
import {Button, Card, Col, Collapse, Container, Row, Spinner, Table} from 'react-bootstrap';
import {toast} from 'react-toastify';
import NormForm from './NormForm';
import AsyncHeadNormSelect from '../../components/AsyncSelect/AsyncHeadNormSelect';
import ListControls from '../../components/generic/ListControls.jsx';

const PAGE_SIZE = 10;

export default function SionNormList() {
    const [norms, setNorms] = useState([]);
    const [loading, setLoading] = useState(true);

    const [expanded, setExpanded] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [creating, setCreating] = useState(false);

    // paging/sort/search/filters
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortOrder, setSortOrder] = useState(''); // 'asc' | 'desc' | ''
    const [filters, setFilters] = useState({head_norm: null});

    const ordering = useMemo(
        () => (sortField ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : ''),
        [sortField, sortOrder]
    );

    const fetchData = useCallback(async (pageNum = 1) => {
        setLoading(true);
        try {
            const params = {
                page: pageNum,
                page_size: PAGE_SIZE,
                search: searchQuery || undefined,
                ordering: ordering || undefined,
                ...(filters.head_norm?.id ? {head_norm: filters.head_norm.id} : {}),
            };
            const res = await axios.get('sion-classes/', {params});
            const results = res?.data?.results ?? [];
            const count = res?.data?.count ?? results.length;
            setNorms(results);
            setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
        } catch (err) {
            console.error('Failed to fetch norms', err);
            toast.error('Failed to load SION norms');
        } finally {
            setLoading(false);
        }
    }, [filters.head_norm, ordering, searchQuery]);

    useEffect(() => {
        fetchData(page);
    }, [page, fetchData]);

    useEffect(() => {
        document.title = 'SION NORMS';
    }, []);

    const sortOptions = [
        {label: 'Newest', value: 'created_at:desc'},
        {label: 'Recently Modified', value: 'modified_at:desc'},
        {label: 'Norm Class ⬆️', value: 'norm_class:asc'},
        {label: 'Norm Class ⬇️', value: 'norm_class:desc'},
    ];

    const controlFilters = [
        <AsyncHeadNormSelect
            key="head_norm"
            value={filters.head_norm}
            onChange={(selected) => {
                setPage(1);
                setFilters((prev) => ({...prev, head_norm: selected}));
            }}
            styles={{container: (b) => ({...b, width: '100%'}), control: (b) => ({...b, width: '100%'})}}
            isClearable
        />,
    ];

    const refresh = async () => {
        await fetchData(page);
    };

    return (
        <Container className="mt-4">
            <ListControls
                title="📋 SION Norms"
                search={searchQuery}
                setSearch={(v) => {
                    setPage(1);
                    setSearchQuery(v);
                }}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={(f) => {
                    setPage(1);
                    setSortField(f);
                }}
                setSortOrder={(o) => {
                    setPage(1);
                    setSortOrder(o);
                }}
                setPage={setPage}
                sortOptions={sortOptions}
                filters={controlFilters}
                onAddNew={() => {
                    setCreating((s) => !s);
                    setEditingId(null);
                }}
                onReset={() => {
                    setFilters({head_norm: null});
                    setSearchQuery('');
                    setSortField('');
                    setSortOrder('');
                    setPage(1);
                }}
            />

            {/* Create panel */}
            {creating && (
                <Card className="mb-3 border-success">
                    <Card.Header className="bg-success text-white"><strong>New Norm</strong></Card.Header>
                    <div className="p-3">
                        <NormForm
                            norm={{}} // empty -> create mode
                            onSaved={async () => {
                                setCreating(false);
                                await refresh();
                            }}
                            onClose={() => setCreating(false)}
                        />
                    </div>
                </Card>
            )}

            {/* List */}
            {loading ? (
                <div className="py-4 text-center"><Spinner animation="border" variant="primary"/></div>
            ) : (
                norms.map((norm) => {
                    const isEditing = editingId === norm.id;
                    return (
                        <Card key={norm.id} className="mb-3 shadow-sm border-0 rounded-3">
                            <Card.Header
                                className="bg-light fw-semibold"
                                onClick={() => setExpanded((p) => ({...p, [norm.id]: !p[norm.id]}))}
                                style={{cursor: 'pointer'}}
                            >
                                <Row className="g-2">
                                    <Col xs={12} md>{norm.norm_class}</Col>
                                    <Col xs={12} md>{norm.description}</Col>
                                    <Col xs="auto" className="ms-auto">
                                        {!isEditing && (
                                            <Button
                                                size="sm"
                                                variant="outline-primary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingId(norm.id);
                                                    setExpanded((p) => ({...p, [norm.id]: true}));
                                                    setCreating(false);
                                                }}
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </Col>
                                </Row>
                            </Card.Header>

                            <Collapse in={!!expanded[norm.id]}>
                                <div className="p-3 border-top border-primary-subtle bg-light-subtle">
                                    {isEditing ? (
                                        <>
                                            <NormForm
                                                norm={norm}
                                                onSaved={async () => {
                                                    setEditingId(null);
                                                    await refresh();
                                                }}
                                                onClose={() => setEditingId(null)}
                                            />
                                        </>
                                    ) : (
                                        <div className="table-responsive">
                                            <Table bordered size="sm" className="mb-3">
                                                <thead>
                                                <tr>
                                                    <th colSpan={3}><strong className="text-primary">Export
                                                        Norm</strong></th>
                                                </tr>
                                                <tr>
                                                    <th>Description</th>
                                                    <th>Quantity</th>
                                                    <th>Unit</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {(norm.export_norm || []).map((e, i) => (
                                                    <tr key={`export-${norm.id}-${i}`}>
                                                        <td>{e.description}</td>
                                                        <td>{e.quantity}</td>
                                                        <td>{e.unit}</td>
                                                    </tr>
                                                ))}
                                                <tr>
                                                    <th colSpan={4}><strong className="text-primary">Import
                                                        Norm</strong></th>
                                                </tr>
                                                <tr>
                                                    <th>Sr No</th>
                                                    <th>Description</th>
                                                    <th>HSN / HS Code</th>
                                                    <th>Qty (Unit)</th>
                                                </tr>
                                                {(norm.import_norm || []).map((r, i) => (
                                                    <tr key={`import-${norm.id}-${i}`}>
                                                        <td>{r.sr_no}</td>
                                                        <td>{r.description}</td>
                                                        <td>{r.hsn_code?.hs_code ?? "—"}</td>
                                                        <td>{r.quantity} {r.unit || ""}</td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </Collapse>
                        </Card>
                    );
                })
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
                    <Button
                        variant="outline-primary"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => prev - 1)}
                    >
                        ← Previous
                    </Button>
                    <span className="fw-medium">Page {page} of {totalPages}</span>
                    <Button
                        variant="outline-primary"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => prev + 1)}
                    >
                        Next →
                    </Button>
                </div>
            )}
        </Container>
    );
}
