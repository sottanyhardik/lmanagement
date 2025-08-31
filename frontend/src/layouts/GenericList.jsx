// src/layouts/GenericList.jsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import axios from '../api/axiosInstance';
import {toast} from 'react-toastify';
import {Container} from 'react-bootstrap';
import ListControls from '../components/generic/ListControls.jsx';
import GenericTable from '../components/generic/GenericTable.jsx';
import PaginationControls from '../components/generic/PaginationControls.jsx';
import AddItemModal from '../components/AddItemModal';

const DEFAULT_PAGE_SIZE = 10;

const GenericList = ({
                         resource = 'companies',          // e.g. "companies" → axios baseURL handles "/api/"
                         title = 'Company List',
                         fields = [],
                         validateItem = () => ({}),
                         initialItem = {},
                         renderField = {},
                         renderInput = {},
                         pageSize = DEFAULT_PAGE_SIZE,
                     }) => {
    const [items, setItems] = useState([]);
    const [editedItem, setEditedItem] = useState({});
    const [editIndex, setEditIndex] = useState(null);
    const [errors, setErrors] = useState({});
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState(''); // 'asc' | 'desc' | ''
    const [sortField, setSortField] = useState(''); // '' means no ordering
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);

    const [newItem, setNewItem] = useState(initialItem);
    const [addErrors, setAddErrors] = useState({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [adding, setAdding] = useState(false);

    const inputRef = useRef(null);
    const abortRef = useRef(null);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil((totalCount || 0) / pageSize)),
        [totalCount, pageSize]
    );

    // -- fetch list (abortable) -------------------------------------------------
    const fetchItems = useCallback(async () => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        try {
            const params = {
                page,
                page_size: pageSize,
                search: search || undefined,
                ordering: sortField
                    ? `${sortOrder === 'desc' ? '-' : ''}${sortField}`
                    : undefined,
            };

            const {data} = await axios.get(`${resource}/`, {
                params,
                signal: controller.signal,
            });

            setItems(data.results ?? data ?? []);
            setTotalCount(data.count ?? (Array.isArray(data) ? data.length : 0));
            setSelectedIds([]); // clear selection on new data
        } catch (err) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
            console.error('Fetch error:', err);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [resource, page, pageSize, search, sortField, sortOrder]);

    // document title
    useEffect(() => {
        if (title) document.title = String(title).toUpperCase();
    }, [title]);

    // trigger loads
    useEffect(() => {
        fetchItems();
        return () => abortRef.current?.abort();
    }, [fetchItems]);

    // -- inline edit ------------------------------------------------------------
    const validate = useCallback(() => {
        const newErrors = validateItem(editedItem);
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [editedItem, validateItem]);

    const handleEditClick = useCallback(
        (index) => {
            setEditIndex(index);
            setEditedItem({...items[index]});
            setErrors({});
            setTimeout(() => inputRef.current?.focus(), 0);
        },
        [items]
    );

    const handleChange = useCallback((e) => {
        const {name, value} = e.target;
        setEditedItem((prev) => ({...prev, [name]: value}));
    }, []);

    const handleCancel = useCallback(() => {
        setEditIndex(null);
        setEditedItem({});
        setErrors({});
    }, []);

    const handleSave = useCallback(async () => {
        if (!validate()) return;
        try {
            const {data} = await axios.put(`${resource}/${editedItem.id}/`, editedItem);
            const updated = [...items];
            updated[editIndex] = data ?? editedItem;
            setItems(updated);
            setEditIndex(null);
            setEditedItem({});
            setErrors({});
            toast.success('✅ Saved successfully');
        } catch (err) {
            const apiErrors = err?.response?.data;
            if (apiErrors && typeof apiErrors === 'object') {
                setErrors(apiErrors);
                const nonField = Object.entries(apiErrors)
                    .filter(([key]) => !fields.some((f) => f.name === key))
                    .map(([, val]) => (Array.isArray(val) ? val.join(', ') : String(val)))
                    .filter(Boolean)
                    .join('; ');
                if (nonField) toast.error(`❌ ${nonField}`);
            } else {
                toast.error('❌ Failed to save');
            }
        }
    }, [validate, resource, editedItem, items, editIndex, fields]);

    // -- sorting ---------------------------------------------------------------
    const toggleSort = useCallback(
        (field) => {
            setPage(1);
            if (sortField === field) {
                if (sortOrder === 'asc') setSortOrder('desc');      // asc → desc
                else if (sortOrder === 'desc') {
                    setSortField('');
                    setSortOrder('');               // desc → none
                } else setSortOrder('asc');                         // none → asc
            } else {
                setSortField(field);
                setSortOrder('asc');                                // new field → asc
            }
        },
        [sortField, sortOrder]
    );

    // -- selection -------------------------------------------------------------
    const toggleSelect = useCallback((id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    }, []);

    const toggleSelectAll = useCallback(() => {
        const visibleIds = items.map((c) => c.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
        setSelectedIds(allSelected ? [] : visibleIds);
    }, [items, selectedIds]);

    // -- bulk delete -----------------------------------------------------------
    const deleteSelected = useCallback(async () => {
        if (selectedIds.length === 0) {
            toast.warn('⚠️ No items selected to delete');
            return;
        }
        if (!window.confirm(`Delete ${selectedIds.length} selected item(s)?`)) return;

        try {
            const results = await Promise.all(
                selectedIds.map(async (id) => {
                    try {
                        await axios.delete(`${resource}/${id}/`);
                        return {id, success: true};
                    } catch (err) {
                        return {
                            id,
                            success: false,
                            error: err?.response?.data?.detail || `Failed to delete item ${id}`,
                        };
                    }
                })
            );
            const failed = results.filter((r) => !r.success);
            if (failed.length) {
                toast.error(
                    `❌ Failed to delete ${failed.length} of ${selectedIds.length}: ` +
                    failed.map((f) => f.error).join(', ')
                );
            } else {
                toast.success('🗑️ Deleted selected items');
            }
            fetchItems(); // refresh page
        } catch {
            toast.error('❌ Bulk delete failed');
        }
    }, [selectedIds, resource, fetchItems]);

    // -- add new ---------------------------------------------------------------
    const validateNew = useCallback(() => {
        const v = validateItem(newItem);
        setAddErrors(v);
        return Object.keys(v).length === 0;
    }, [newItem, validateItem]);

    const handleAdd = useCallback(async () => {
        if (!validateNew()) return;
        setAdding(true);
        try {
            const {status} = await axios.post(`${resource}/`, newItem);
            if (status !== 201) {
                toast.error(`❌ Unexpected response (${status})`);
                return;
            }
            toast.success('✅ Added successfully');
            setNewItem(initialItem);
            setAddErrors({});
            setShowAddModal(false);
            // Reset to first page to see new record (optional)
            setPage(1);
            fetchItems();
        } catch (err) {
            const apiErrors = err?.response?.data;
            if (apiErrors && typeof apiErrors === 'object') {
                setAddErrors(apiErrors);
                const nonField = Object.entries(apiErrors)
                    .filter(([key]) => !fields.some((f) => f.name === key))
                    .map(([, val]) => (Array.isArray(val) ? val.join(', ') : String(val)))
                    .filter(Boolean)
                    .join('; ');
                toast.error(nonField || '❌ Please fix validation errors.');
            } else {
                toast.error(`❌ ${err?.message || 'Failed to add item'}`);
            }
        } finally {
            setAdding(false);
        }
    }, [validateNew, resource, newItem, initialItem, fields, fetchItems]);

    return (
        <Container className="mt-4">
            <ListControls
                title={String(title).toUpperCase()}
                search={search}
                setSearch={(v) => {
                    setPage(1);
                    setSearch(v);
                }}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={setSortField}
                setSortOrder={setSortOrder}
                setPage={setPage}
                selectedIds={selectedIds}
                onDeleteSelected={deleteSelected}
                onAddNewClick={() => setShowAddModal(true)}
                onAddNew={false}
            />

            <GenericTable
                loading={loading}
                items={items}
                fields={fields}
                selectedIds={selectedIds}
                editIndex={editIndex}
                editedItem={editedItem}
                errors={errors}
                renderInput={renderInput}
                renderField={renderField}
                inputRef={inputRef}
                sortField={sortField}
                sortOrder={sortOrder}
                toggleSort={toggleSort}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                handleChange={handleChange}
                handleSave={handleSave}
                handleCancel={handleCancel}
                handleEditClick={handleEditClick}
                setEditedItem={setEditedItem}
            />

            <PaginationControls
                page={page}
                totalPages={totalPages}
                setPage={setPage}
                loading={loading}
            />

            <AddItemModal
                show={showAddModal}
                handleClose={() => setShowAddModal(false)}
                fields={fields}
                newItem={newItem}
                setNewItem={setNewItem}
                addErrors={addErrors}
                renderInput={renderInput}
                handleAdd={handleAdd}
                loading={adding}
            />
        </Container>
    );
};

export default GenericList;
