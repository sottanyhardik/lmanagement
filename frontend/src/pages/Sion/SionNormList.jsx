import React, {useCallback, useEffect, useMemo, useState} from 'react';
import axios from '../../api/axiosInstance';
import {Button, Card, Col, Collapse, Container, Row, Spinner, Table,} from 'react-bootstrap';
import {toast} from 'react-toastify';
import NormForm from './NormForm';
import {parseFormErrors} from '../../utils/parseFormErrors';
import AsyncHeadNormSelect from '../../components/AsyncSelect/AsyncHeadNormSelect';
import ListControls from '../../components/ListControls';

const PAGE_SIZE = 10;

const SionNormList = () => {
    const [norms, setNorms] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [expandedCards, setExpandedCards] = useState({});
    const [editStates, setEditStates] = useState({});
    const [savingId, setSavingId] = useState(null);

    // field errors keyed as `${id}:${path}` (e.g. "12:export_norm.0.quantity")
    const [errors, setErrors] = useState({});

    // paging/sort/search/filters
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortOrder, setSortOrder] = useState(''); // 'asc' | 'desc' | ''
    const [filters, setFilters] = useState({head_norm: null});

    // "add new" panel
    const [newNorm, setNewNorm] = useState(null);
    const [newErrors, setNewErrors] = useState({});

    const ordering = useMemo(
        () => (sortField ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : ''),
        [sortField, sortOrder]
    );

    const fetchData = useCallback(
        async (pageNum = 1) => {
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
        },
        [filters.head_norm, ordering, searchQuery]
    );

    // load on first mount and when page changes
    useEffect(() => {
        fetchData(page);
    }, [page, fetchData]);

    // set document title once
    useEffect(() => {
        document.title = 'SION NORMS';
    }, []);

    // --- helpers ----------------------------------------------------

    const toggleCard = (id) => {
        setExpandedCards((prev) => ({...prev, [id]: !prev[id]}));
    };

    const startEditing = (id, norm) => {
        setEditStates((prev) => ({
            ...prev,
            [id]: {
                norm_class: norm.norm_class ?? '',
                head_norm_id: norm.head_norm?.id ?? null,
                head_norm_id_obj: norm.head_norm ?? null,
                description: norm.description ?? '',
                export_norm:
                    (norm.export_norm || []).map((e) => ({...e})) ||
                    [{description: '', quantity: '', unit: ''}],
                import_norm:
                    (norm.import_norm || []).map((r) => ({...r})) ||
                    [{description: '', quantity: '', unit: '', condition: ''}],
            },
        }));
        setExpandedCards((prev) => ({...prev, [id]: true}));
        // clear any stale errors for this id
        setErrors((prev) => {
            const next = {...prev};
            Object.keys(next).forEach((k) => {
                if (k.startsWith(`${id}:`)) delete next[k];
            });
            return next;
        });
    };

    const cancelEditing = (id) => {
        setEditStates((prev) => {
            const next = {...prev};
            delete next[id];
            return next;
        });
        setErrors((prev) => {
            const next = {...prev};
            Object.keys(next).forEach((k) => {
                if (k.startsWith(`${id}:`)) delete next[k];
            });
            return next;
        });
    };

    const clearFieldError = (id, path) => {
        setErrors((prev) => {
            const next = {...prev};
            delete next[`${id}:${path}`];
            return next;
        });
    };

    const handleEditChange = (id, field, value) => {
        setEditStates((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value,
            },
        }));
        clearFieldError(id, field);
    };

    const handleEditImportChange = (id, index, field, value) => {
        setEditStates((prev) => {
            const rec = prev[id] || {};
            const rows = [...(rec.import_norm || [])];
            rows[index] = {...(rows[index] || {}), [field]: value};
            return {...prev, [id]: {...rec, import_norm: rows}};
        });
        clearFieldError(id, `import_norm.${index}.${field}`);
    };

    const handleEditExportChange = (id, index, field, value) => {
        setEditStates((prev) => {
            const rec = prev[id] || {};
            const rows = [...(rec.export_norm || [])];
            rows[index] = {...(rows[index] || {}), [field]: value};
            return {...prev, [id]: {...rec, export_norm: rows}};
        });
        clearFieldError(id, `export_norm.${index}.${field}`);
    };

    const handleAddImportRowEdit = (id) => {
        setEditStates((prev) => {
            const rec = prev[id] || {};
            return {
                ...prev,
                [id]: {
                    ...rec,
                    import_norm: [
                        ...(rec.import_norm || []),
                        {description: '', quantity: '', unit: '', condition: ''},
                    ],
                },
            };
        });
    };

    const handleDeleteImportRowEdit = (id, index) => {
        setEditStates((prev) => {
            const rec = prev[id] || {};
            const rows = [...(rec.import_norm || [])];
            rows.splice(index, 1);
            return {...prev, [id]: {...rec, import_norm: rows}};
        });
    };

    const handleAddExportRowEdit = (id) => {
        setEditStates((prev) => {
            const rec = prev[id] || {};
            return {
                ...prev,
                [id]: {
                    ...rec,
                    export_norm: [
                        ...(rec.export_norm || []),
                        {description: '', quantity: '', unit: ''},
                    ],
                },
            };
        });
    };

    const handleDeleteExportRowEdit = (id, index) => {
        setEditStates((prev) => {
            const rec = prev[id] || {};
            const rows = [...(rec.export_norm || [])];
            rows.splice(index, 1);
            return {...prev, [id]: {...rec, export_norm: rows}};
        });
    };

    const handleAddNewClick = () => {
        if (newNorm) {
            setNewNorm(null);
            setPage(1);
            window.scrollTo({top: 0, behavior: 'smooth'});
            return;
        }
        setExpandedCards({});
        setNewNorm({
            norm_class: '',
            head_norm_id: null,
            head_norm_id_obj: null,
            description: '',
            export_norm: [{description: '', quantity: '', unit: ''}],
            import_norm: [{description: '', quantity: '', unit: '', condition: ''}],
        });
        setNewErrors({});
        window.scrollTo({top: 0, behavior: 'smooth'});
    };

    const saveChanges = async (id) => {
        const data = editStates[id];
        if (!data) return;

        setSavingId(id);
        try {
            const payload = {
                norm_class: data.norm_class,
                head_norm_id: data.head_norm_id,
                description: data.description,
                export_norm: data.export_norm,
                import_norm: data.import_norm,
            };
            await axios.patch(`sion-classes/${id}/`, payload);
            toast.success(`Norm "${data.norm_class}" updated`);
            cancelEditing(id);
            fetchData(page);
        } catch (err) {
            const parsed = parseFormErrors(err);
            // re-key with id prefix
            const errorMap = {};
            Object.keys(parsed).forEach((k) => {
                // convert bracket indices to dot for consistency with NormForm's errors.get
                const dotKey = k.replace(/\[(\d+)\]/g, '.$1');
                errorMap[`${id}:${dotKey}`] = parsed[k];
            });
            setErrors((prev) => ({...prev, ...errorMap}));
            toast.error('Please fix the highlighted errors.');
        } finally {
            setSavingId(null);
        }
    };

    const getError = (id, path) => errors[`${id}:${path}`] || '';

    // ---- controls config ------------------------------------------------

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
            styles={{
                container: (base) => ({...base, width: '100%'}),
                control: (base) => ({...base, width: '100%'}),
            }}
            isClearable
        />,
    ];

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
                onAddNew={handleAddNewClick}
                onReset={() => {
                    setFilters({head_norm: null});
                    setSearchQuery('');
                    setSortField('');
                    setSortOrder('');
                    setPage(1);
                }}
            />

            {/* --- Create New Norm panel --- */}
            {newNorm && (
                <Card className="mb-3 border-success">
                    <Card.Header className="bg-success text-white">
                        <strong>New Norm</strong>
                    </Card.Header>
                    <div className="p-3">
                        <NormForm
                            normData={newNorm}
                            onChange={(field, value) => {
                                setNewNorm((prev) => ({...prev, [field]: value}));
                                setNewErrors((prev) => {
                                    const next = {...prev};
                                    delete next[field];
                                    return next;
                                });
                            }}
                            onImportChange={(i, field, value) => {
                                setNewNorm((prev) => {
                                    const rows = [...prev.import_norm];
                                    rows[i] = {...(rows[i] || {}), [field]: value};
                                    return {...prev, import_norm: rows};
                                });
                                setNewErrors((prev) => {
                                    const next = {...prev};
                                    delete next[`import_norm.${i}.${field}`];
                                    delete next[`import_norm[${i}].${field}`];
                                    return next;
                                });
                            }}
                            onAddImportRow={() =>
                                setNewNorm((prev) => ({
                                    ...prev,
                                    import_norm: [
                                        ...prev.import_norm,
                                        {description: '', quantity: '', unit: '', condition: ''},
                                    ],
                                }))
                            }
                            onDeleteImportRow={(i) =>
                                setNewNorm((prev) => {
                                    const rows = [...prev.import_norm];
                                    rows.splice(i, 1);
                                    return {...prev, import_norm: rows};
                                })
                            }
                            onExportChange={(i, field, value) => {
                                setNewNorm((prev) => {
                                    const rows = [...prev.export_norm];
                                    rows[i] = {...(rows[i] || {}), [field]: value};
                                    return {...prev, export_norm: rows};
                                });
                                setNewErrors((prev) => {
                                    const next = {...prev};
                                    delete next[`export_norm.${i}.${field}`];
                                    delete next[`export_norm[${i}].${field}`];
                                    return next;
                                });
                            }}
                            onAddExportRow={() =>
                                setNewNorm((prev) => ({
                                    ...prev,
                                    export_norm: [
                                        ...prev.export_norm,
                                        {description: '', quantity: '', unit: ''},
                                    ],
                                }))
                            }
                            onDeleteExportRow={(i) =>
                                setNewNorm((prev) => {
                                    const rows = [...prev.export_norm];
                                    rows.splice(i, 1);
                                    return {...prev, export_norm: rows};
                                })
                            }
                            errors={{
                                get: (path) =>
                                    newErrors[path] ||
                                    newErrors[path.replace(/\./g, '.__dot__')] || // no-op fallback
                                    '',
                            }}
                            isNew
                        />
                        <Button
                            className="mt-3 me-2"
                            size="sm"
                            variant="success"
                            onClick={async () => {
                                try {
                                    const payload = {
                                        norm_class: newNorm.norm_class,
                                        head_norm_id: newNorm.head_norm_id_obj?.value ?? newNorm.head_norm_id?.id ?? newNorm.head_norm_id,
                                        description: newNorm.description,
                                        export_norm: newNorm.export_norm,
                                        import_norm: newNorm.import_norm,
                                    };
                                    await axios.post('sion-classes/', payload);
                                    toast.success(`Norm "${newNorm.norm_class}" added`);
                                    setNewNorm(null);
                                    setPage(1);
                                    fetchData(1);
                                } catch (err) {
                                    const parsed = parseFormErrors(err);
                                    // normalize bracket indices to dot notation
                                    const normalized = {};
                                    Object.entries(parsed).forEach(([k, v]) => {
                                        normalized[k.replace(/\[(\d+)\]/g, '.$1')] = v;
                                    });
                                    setNewErrors(normalized);
                                    toast.error('Please fix the highlighted errors.');
                                }
                            }}
                        >
                            Save
                        </Button>
                        <Button
                            className="mt-3"
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setNewNorm(null)}
                        >
                            Cancel
                        </Button>
                    </div>
                </Card>
            )}

            {/* --- List --- */}
            {loading ? (
                <div className="py-4 text-center">
                    <Spinner animation="border" variant="primary"/>
                </div>
            ) : (
                norms.map((norm) => {
                    const isEditing = !!editStates[norm.id];
                    const data = isEditing ? editStates[norm.id] : norm;

                    return (
                        <Card key={norm.id} className="mb-3 shadow-sm border-0 rounded-3">
                            <Card.Header
                                className="bg-light fw-semibold"
                                onClick={() => toggleCard(norm.id)}
                                style={{cursor: 'pointer'}}
                            >
                                <Row className="g-2">
                                    <Col xs={12} md>
                                        {norm.norm_class}
                                    </Col>
                                    <Col xs={12} md>
                                        {norm.description}
                                    </Col>
                                    <Col xs="auto" className="ms-auto">
                                        {!isEditing && (
                                            <Button
                                                size="sm"
                                                variant="outline-primary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEditing(norm.id, norm);
                                                }}
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </Col>
                                </Row>
                            </Card.Header>

                            <Collapse in={!!expandedCards[norm.id]}>
                                <div className="p-3 border-top border-primary-subtle bg-light-subtle">
                                    {isEditing ? (
                                        <>
                                            <NormForm
                                                normData={data}
                                                onChange={(field, value) =>
                                                    handleEditChange(norm.id, field, value)
                                                }
                                                onImportChange={(i, field, value) =>
                                                    handleEditImportChange(norm.id, i, field, value)
                                                }
                                                onAddImportRow={() => handleAddImportRowEdit(norm.id)}
                                                onDeleteImportRow={(i) =>
                                                    handleDeleteImportRowEdit(norm.id, i)
                                                }
                                                onExportChange={(i, field, value) =>
                                                    handleEditExportChange(norm.id, i, field, value)
                                                }
                                                onAddExportRow={() => handleAddExportRowEdit(norm.id)}
                                                onDeleteExportRow={(i) =>
                                                    handleDeleteExportRowEdit(norm.id, i)
                                                }
                                                errors={{
                                                    get: (path) => getError(norm.id, path),
                                                }}
                                            />
                                            <Button
                                                className="mt-3 me-2"
                                                size="sm"
                                                variant="success"
                                                onClick={() => saveChanges(norm.id)}
                                                disabled={savingId === norm.id}
                                            >
                                                {savingId === norm.id ? 'Saving…' : 'Save'}
                                            </Button>
                                            <Button
                                                className="mt-3"
                                                size="sm"
                                                variant="outline-secondary"
                                                onClick={() => cancelEditing(norm.id)}
                                                disabled={savingId === norm.id}
                                            >
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="table-responsive">
                                            <Table bordered size="sm" className="mb-3">
                                                <thead>
                                                <tr>
                                                    <th colSpan={3}>
                                                        <strong className="text-primary">Export Norm</strong>
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <th>Description</th>
                                                    <th>Quantity</th>
                                                    <th>Unit</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {(norm.export_norm || []).map((e, index) => (
                                                    <tr key={`export-${norm.id}-${index}`}>
                                                        <td>{e.description}</td>
                                                        <td>{e.quantity}</td>
                                                        <td>{e.unit}</td>
                                                    </tr>
                                                ))}
                                                <tr>
                                                    <th colSpan={3}>
                                                        <strong className="text-primary">Import Norm</strong>
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <th>Description</th>
                                                    <th>Quantity</th>
                                                    <th>Unit</th>
                                                </tr>
                                                {(norm.import_norm || []).map((row, index) => (
                                                    <tr key={`import-${norm.id}-${index}`}>
                                                        <td>{row.description}</td>
                                                        <td>{row.quantity}</td>
                                                        <td>{row.unit}</td>
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
                    <span className="fw-medium">
            Page {page} of {totalPages}
          </span>
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
};

export default SionNormList;
