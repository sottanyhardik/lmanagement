import React, {useEffect, useState} from 'react';
import axios from '../../api/axiosInstance';
import {Button, Card, Col, Collapse, Container, Row, Spinner} from 'react-bootstrap';
import {toast} from 'react-toastify';
import NormForm from './NormForm';
import {parseFormErrors} from '../../utils/parseFormErrors';
import AsyncHeadNormSelect from './AsyncHeadNormSelect';


const SionNormList = () => {
    const [norms, setNorms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedCards, setExpandedCards] = useState({});
    const [editStates, setEditStates] = useState({});
    const [errors, setErrors] = useState({});
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10); // Or any default page size
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortOrder, setSortOrder] = useState(''); // 'asc' or 'desc'
    const [filters, setFilters] = useState({item: '', head_norm: null});

    const fetchData = async (pageNum = page) => {
        setLoading(true);
        try {
            const params = {
                page: pageNum,
                page_size: pageSize,
                search: searchQuery,
                ordering: sortOrder === 'desc' ? `-${sortField}` : sortField,
                ...(filters.head_norm ? {head_norm: filters.head_norm.id} : {}),
                ...(filters.item ? {item: filters.item} : {}),
            };
            const res = await axios.get('/api/sion-classes/', {params});
            setNorms(res.data.results);
            setTotalPages(pageSize);
        } catch (err) {
            console.error('Failed to fetch norms', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, searchQuery, filters, sortField, sortOrder]);

    const toggleCard = (id) => {
        setExpandedCards(prev => ({[id]: !prev[id]}));
    };

    const startEditing = (id, norm) => {
        setEditStates(prev => ({
            ...prev,
            [id]: {
                norm_class: norm.norm_class,
                head_norm_id: norm.head_norm?.id,
                head_norm_id_obj: norm.head_norm,
                description: norm.description,
                export_norm: norm.export_norm?.map(e => ({...e})) || [{description: '', quantity: '', unit: ''}],
                import_norm: norm.import_norm.map(r => ({...r}))
            }
        }));
        setExpandedCards({[id]: true});
        setErrors(prev => ({...prev, [id]: {}}));
    };

    const cancelEditing = (id) => {
        const updated = {...editStates};
        delete updated[id];
        setEditStates(updated);
        setErrors(prev => {
            const updatedErrors = {...prev};
            delete updatedErrors[id];
            return updatedErrors;
        });
    };

    const handleEditChange = (id, field, value) => {
        setEditStates(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
        setErrors(prev => ({...prev, [id]: {...prev[id], [field]: undefined}}));
    };

    const handleEditImportChange = (id, index, field, value) => {
        const updated = [...editStates[id].import_norm];
        updated[index][field] = value;
        handleEditChange(id, 'import_norm', updated);
        setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[`${id}:import_norm[${index}].${field}`];
            return newErrors;
        });
    };

    const handleEditExportChange = (id, index, field, value) => {
        const updated = [...editStates[id].export_norm];
        updated[index][field] = value;
        handleEditChange(id, 'export_norm', updated);
        setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[`${id}:export_norm[${index}].${field}`];
            return newErrors;
        });
    };

    const handleAddImportRowEdit = (id) => {
        const updated = [...editStates[id].import_norm];
        updated.push({description: '', quantity: '', unit: '', condition: ''});
        handleEditChange(id, 'import_norm', updated);
    };

    const handleDeleteImportRowEdit = (id, index) => {
        const updated = [...editStates[id].import_norm];
        updated.splice(index, 1);
        handleEditChange(id, 'import_norm', updated);
    };

    const handleAddExportRowEdit = (id) => {
        const updated = [...editStates[id].export_norm || []];
        updated.push({description: '', quantity: '', unit: ''});
        handleEditChange(id, 'export_norm', updated);
    };

    const handleDeleteExportRowEdit = (id, index) => {
        const updated = [...editStates[id].export_norm];
        updated.splice(index, 1);
        handleEditChange(id, 'export_norm', updated);
    };

    const saveChanges = async (id) => {
        try {
            const data = editStates[id];
            const payload = {
                norm_class: data.norm_class,
                head_norm_id: data.head_norm_id,
                description: data.description,
                export_norm: data.export_norm,
                import_norm: data.import_norm
            };
            await axios.patch(`/api/sion-classes/${id}/`, payload);
            toast.success('Norm updated');
            cancelEditing(id);
        } catch (err) {
            const parsed = parseFormErrors(err);
            const errorMap = {};
            Object.keys(parsed).forEach(k => {
                errorMap[`${id}:${k}`] = parsed[k];
            });
            setErrors(prev => ({...prev, ...errorMap}));
            toast.error('Please fix form errors');
        }
    };

    const getError = (id, path) => errors[`${id}:${path}`] || '';

    return (
        <Container className="mt-4">
            <h3 className="mb-4">SION Norms List</h3>
            <div className="d-flex flex-wrap align-items-center mb-3 gap-3">
                <input
                    type="text"
                    placeholder="Search..."
                    className="form-control w-auto"
                    value={searchQuery}
                    onChange={e => {
                        setPage(1);
                        setSearchQuery(e.target.value);
                    }}
                />

                <AsyncHeadNormSelect
                    value={filters.head_norm}
                    onChange={(selected) => {
                        setPage(1);
                        setFilters(prev => ({...prev, head_norm: selected}));
                    }}
                />

                <select
                    className="form-select w-auto"
                    value={`${sortField}:${sortOrder}`}
                    onChange={e => {
                        const [field, order] = e.target.value.split(':');
                        setPage(1);
                        setSortField(field);
                        setSortOrder(order);
                    }}
                >
                    <option value=":">Sort By</option>
                    <option value="norm_class:asc">Norm Class ↑</option>
                    <option value="norm_class:desc">Norm Class ↓</option>
                    <option value="description:asc">Description ↑</option>
                    <option value="description:desc">Description ↓</option>
                </select>
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                        setFilters({item: '', head_norm: null});
                        setSearchQuery('');
                        setSortField('');
                        setSortOrder('');
                        setPage(1);
                    }}
                >
                    Clear Filters
                </Button>
            </div>

            {loading ? (
                <Spinner animation="border" variant="primary"/>
            ) : (
                norms.map(norm => {
                    const isEditing = !!editStates[norm.id];
                    const data = isEditing ? editStates[norm.id] : norm;
                    return (
                        <Card key={norm.id} className="mb-3">
                            <Card.Header onClick={() => toggleCard(norm.id)} style={{cursor: 'pointer'}}>
                                <Row>
                                    <Col>{norm.norm_class}</Col>
                                    <Col>{norm.description}</Col>
                                    <Col className="text-end">
                                        {!isEditing && <Button size="sm" variant="outline-primary" onClick={(e) => {
                                            e.stopPropagation();
                                            startEditing(norm.id, norm);
                                        }}>Edit</Button>}
                                    </Col>
                                </Row>
                            </Card.Header>
                            <Collapse in={!!expandedCards[norm.id]}>
                                <div className="p-3">
                                    {isEditing ? (
                                        <>
                                            <NormForm
                                                normData={data}
                                                onChange={(field, value) => handleEditChange(norm.id, field, value)}
                                                onImportChange={(i, field, value) => handleEditImportChange(norm.id, i, field, value)}
                                                onAddImportRow={() => handleAddImportRowEdit(norm.id)}
                                                onDeleteImportRow={(i) => handleDeleteImportRowEdit(norm.id, i)}
                                                onExportChange={(i, field, value) => handleEditExportChange(norm.id, i, field, value)}
                                                onAddExportRow={() => handleAddExportRowEdit(norm.id)}
                                                onDeleteExportRow={(i) => handleDeleteExportRowEdit(norm.id, i)}
                                                errors={{
                                                    get: (path) => getError(norm.id, path)
                                                }}
                                            />
                                            <Button className="mt-3 me-2" size="sm" variant="success"
                                                    onClick={() => saveChanges(norm.id)}>Save</Button>
                                            <Button className="mt-3" size="sm" variant="outline-secondary"
                                                    onClick={() => cancelEditing(norm.id)}>Cancel</Button>
                                        </>
                                    ) : (
                                        <div>
                                            <table className="table table-bordered">
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
                                                {norm.export_norm?.map((e, index) => (
                                                    <tr key={`export-${index}`}>
                                                        <td>{e.description}</td>
                                                        <td>{e.quantity}</td>
                                                        <td>{e.unit}</td>
                                                    </tr>
                                                ))}
                                                <tr>
                                                    <th colSpan={3}><strong className="text-primary">Import
                                                        Norm</strong></th>
                                                </tr>
                                                <tr>
                                                    <th>Description</th>
                                                    <th>Quantity</th>
                                                    <th>Unit</th>
                                                </tr>
                                                {norm.import_norm?.map((row, index) => (
                                                    <tr key={`import-${index}`}>
                                                        <td>{row.description}</td>
                                                        <td>{row.quantity}</td>
                                                        <td>{row.unit}</td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </Collapse>
                        </Card>
                    );
                })
            )}
            {!loading && totalPages > 1 && (
                <div className="d-flex justify-content-center mt-4">
                    <Button
                        variant="outline-primary"
                        className="me-2"
                        disabled={page === 1}
                        onClick={() => setPage(prev => prev - 1)}
                    >
                        Previous
                    </Button>
                    <span className="align-self-center">Page {page} of {totalPages}</span>
                    <Button
                        variant="outline-primary"
                        className="ms-2"
                        disabled={page === totalPages}
                        onClick={() => setPage(prev => prev + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </Container>
    );
};

export default SionNormList;
