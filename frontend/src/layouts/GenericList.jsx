import {useEffect, useRef, useState} from 'react';
import axios from '../api/axiosInstance';
import {toast} from 'react-toastify';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

const PAGE_SIZE = 10;

const GenericList = ({
                         resource = 'companies',
                         title = 'Company List',
                         fields = [],
                         filters = [],
                         validateItem = () => ({}),
                         initialItem = {},
                         renderField = {},
                         renderInput = {},
                     }) => {
    const [items, setItems] = useState([]);
    const [editedItem, setEditedItem] = useState({});
    const [editIndex, setEditIndex] = useState(null);
    const [errors, setErrors] = useState({});
    const [search, setSearch] = useState('');
    const [ordering, setOrdering] = useState('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState(initialItem);
    const [addErrors, setAddErrors] = useState({});
    const addModalRef = useRef();
    const inputRef = useRef();

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/${resource}/`, {
                params: {
                    page,
                    page_size: PAGE_SIZE,
                    search,
                    ordering: ordering || undefined,
                },
            });
            const data = res.data;
            setItems(data.results || data);
            setTotalCount(data.count || data.length || 0);
            setSelectedIds([]);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [page, search, ordering]);

    const validate = () => {
        const newErrors = validateItem(editedItem);
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleEditClick = (index) => {
        setEditIndex(index);
        setEditedItem({...items[index]});
        setErrors({});
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleChange = (e) => {
        const {name, value} = e.target;
        setEditedItem((prev) => ({...prev, [name]: value}));
    };

    const handleCancel = () => {
        setEditIndex(null);
        setEditedItem({});
        setErrors({});
    };

    const handleSave = async () => {
        if (!validate()) return;
        try {
            const response = await axios.put(`/${resource}/${editedItem.id}/`, editedItem);
            const updated = [...items];
            updated[editIndex] = editedItem;
            setItems(updated);
            setEditIndex(null);
            setEditedItem({});
            setErrors({});
            if (response.status === 200) {
                toast.success('✅ Saved successfully');
            } else {
                toast.error('❌ Failed to save');
            }
        } catch (err) {
            if (err.response?.data) {
                const apiErrors = err.response.data;
                setErrors(apiErrors);

                const nonFieldErrors = Object.entries(apiErrors)
                    .filter(([key]) => !fields.some((f) => f.name === key))
                    .map(([_, val]) => (Array.isArray(val) ? val.join(', ') : val))
                    .join('');

                if (nonFieldErrors) {
                    toast.error(`❌ ${nonFieldErrors}`);
                }
            } else {
                toast.error('❌ Failed to save');
            }
        }
    };

    const toggleSort = (field) => {
        if (ordering === field) setOrdering(`-${field}`);
        else if (ordering === `-${field}`) setOrdering('');
        else setOrdering(field);
        setPage(1);
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        const visibleIds = items.map((c) => c.id);
        const allSelected = visibleIds.every((id) => selectedIds.includes(id));
        setSelectedIds(allSelected ? [] : visibleIds);
    };

    const deleteSelected = async () => {
        if (selectedIds.length === 0) {
            toast.warn('⚠️ No items selected to delete');
            return;
        }
        if (!window.confirm(`Delete ${selectedIds.length} selected items?`)) return;
        try {
            const results = await Promise.all(
                selectedIds.map(async (id) => {
                    try {
                        await axios.delete(`/${resource}/${id}/`);
                        return {id, success: true};
                    } catch (err) {
                        return {
                            id,
                            success: false,
                            error: err.response?.data?.detail || `Failed to delete item ${id}`,
                        };
                    }
                })
            );
            const failed = results.filter((r) => !r.success);
            if (failed.length > 0) {
                toast.error(
                    `❌ Failed to delete ${failed.length} of ${selectedIds.length} items: ` +
                    failed.map((f) => f.error).join(', ')
                );
            } else {
                toast.success('🗑️ Deleted selected items');
            }
            fetchItems();
        } catch (err) {
            toast.error('❌ Bulk delete failed');
        }
    };

    const validateNew = () => {
        const errors = validateItem(newItem);
        setAddErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleAdd = async () => {
        if (!validateNew()) return;
        try {
            const response = await axios.post(`/${resource}/`, newItem);
            if (response.status === 201) {
                toast.success('✅ Added');
            } else {
                toast.error('❌ Failed to add');
                return;
            }
            setNewItem(initialItem);
            setAddErrors({});
            const modal = bootstrap.Modal.getInstance(addModalRef.current);
            modal.hide();
            fetchItems();
        } catch (err) {
            if (err.response?.data) {
                const apiErrors = err.response.data;
                setAddErrors(apiErrors);

                const nonFieldErrors = Object.entries(apiErrors)
                    .filter(([key]) => !fields.some((f) => f.name === key))
                    .map(([_, val]) => (Array.isArray(val) ? val.join(', ') : val))
                    .join('');

                if (nonFieldErrors) {
                    toast.error(`❌ ${nonFieldErrors}`);
                }
            } else {
                toast.error('❌ Failed to add');
            }
        }
    };

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="fw-bold mb-0">📋 {title}</h3>
                <button
                    className="btn btn-primary btn-sm shadow-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#addItemModal"
                >
                    ➕ Add
                </button>
            </div>

            <div className="card card-body border-0 shadow-sm mb-3">
                <div className="row row-cols-auto g-2 align-items-end">
                    <div className="col">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="🔍 Search..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            onKeyUp={() => fetchItems()}
                        />
                    </div>
                    {selectedIds.length > 0 && (
                        <div className="col">
                            <button className="btn btn-danger btn-sm" onClick={deleteSelected}>
                                🗑️ Delete Selected ({selectedIds.length})
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <table className="table table-sm table-hover table-striped align-middle">
                    <thead className="table-light">
                    <tr className="text-nowrap">
                        <th>
                            <div className="form-check form-switch">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={items.length > 0 && items.every((c) => selectedIds.includes(c.id))}
                                    onChange={toggleSelectAll}
                                />
                            </div>
                        </th>
                        {fields.map((f) => (
                            <th
                                key={f.name}
                                style={{cursor: 'pointer'}}
                                onClick={() => toggleSort(f.name)}
                            >
                                {f.label}
                                {ordering === f.name ? ' ▲' : ordering === `-${f.name}` ? ' ▼' : ''}
                            </th>
                        ))}
                        <th className="text-center">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((item, index) => (
                        <tr key={item.id}>
                            <td>
                                <div className="form-check form-switch">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                    />
                                </div>
                            </td>
                            {fields.map((f) => (
                                <td key={f.name}>
                                    {editIndex === index ? (
                                        renderInput[f.name] ? (
                                            renderInput[f.name](editedItem[f.name], (val) =>
                                                setEditedItem((prev) => ({...prev, [f.name]: val}))
                                            )
                                        ) : (
                                            <>
                                                <input
                                                    ref={f.name === fields[0].name ? inputRef : null}
                                                    type="text"
                                                    name={f.name}
                                                    className={`form-control form-control-sm ${errors[f.name] ? 'is-invalid' : ''}`}
                                                    value={editedItem[f.name] || ''}
                                                    onChange={handleChange}
                                                />
                                                {errors[f.name] && (
                                                    <div className="invalid-feedback">{errors[f.name]}</div>
                                                )}
                                            </>
                                        )
                                    ) : renderField[f.name] ? (
                                        renderField[f.name](item[f.name], item)
                                    ) : (
                                        item[f.name]
                                    )}
                                </td>
                            ))}
                            <td className="text-center">
                                {editIndex === index ? (
                                    <div className="d-flex gap-1 justify-content-center">
                                        <button className="btn btn-success btn-sm" onClick={handleSave}>💾</button>
                                        <button className="btn btn-outline-success btn-sm" onClick={handleCancel}>❌
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn btn-outline-primary btn-sm"
                                            onClick={() => handleEditClick(index)}>
                                        ✏️
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}

            <div className="d-flex justify-content-between align-items-center mt-3">
                <span className="text-muted">Page {page} of {totalPages}</span>
                <div className="btn-group btn-group-sm">
                    <button
                        className="btn btn-outline-success"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                    >
                        ← Prev
                    </button>
                    <button
                        className="btn btn-outline-success"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next →
                    </button>
                </div>
            </div>

            <div className="modal fade" id="addItemModal" tabIndex="-1" ref={addModalRef}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">➕ Add</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"/>
                        </div>
                        <div className="modal-body">
                            {fields.map((f) => (
                                <div className="mb-3" key={f.name}>
                                    <label className="form-label">{f.label}</label>
                                    {renderInput[f.name] ? (
                                        renderInput[f.name](newItem[f.name], (val) =>
                                            setNewItem((prev) => ({...prev, [f.name]: val}))
                                        )
                                    ) : (
                                        <input
                                            type="text"
                                            className={`form-control ${addErrors[f.name] ? 'is-invalid' : ''}`}
                                            value={newItem[f.name] || ''}
                                            onChange={(e) =>
                                                setNewItem((prev) => ({...prev, [f.name]: e.target.value}))
                                            }
                                        />
                                    )}
                                    {addErrors[f.name] && (
                                        <div className="invalid-feedback">{addErrors[f.name]}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-success" data-bs-dismiss="modal">Cancel</button>
                            <button className="btn btn-primary" onClick={handleAdd}>Add</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenericList;
