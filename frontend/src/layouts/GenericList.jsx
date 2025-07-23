import React, {useEffect, useRef, useState} from 'react';
import axios from '../api/axiosInstance';
import {toast} from 'react-toastify';
import {Container} from 'react-bootstrap';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import ListControls from '../components/ListControls';
import GenericTable from '../components/GenericTable';
import PaginationControls from '../components/PaginationControls';
import AddItemModal from '../components/AddItemModal';


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
    const [sortOrder, setSortOrder] = useState(''); // 'asc' or 'desc'
    const [sortField, setSortField] = useState('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState(initialItem);
    const [addErrors, setAddErrors] = useState({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [adding, setAdding] = useState(false);
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
                    ordering: sortOrder === 'desc' ? `-${sortField}` : sortField,
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
        if (title) {
            document.title = title.toUpperCase();
        }
    }, [title]);

    useEffect(() => {
        fetchItems();
    }, [page, search, sortField, sortOrder]);

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
        setPage(1);
        if (sortField === field) {
            if (sortOrder === 'asc') {
                setSortOrder('desc'); // Asc → Desc
            } else if (sortOrder === 'desc') {
                setSortField('');
                setSortOrder('');     // Desc → None
            } else {
                setSortOrder('asc');  // None → Asc
            }
        } else {
            setSortField(field);
            setSortOrder('asc');      // New field → Asc
        }
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

        setAdding(true); // Start loading

        try {
            const response = await axios.post(`/${resource}/`, newItem);

            if (response.status !== 201) {
                toast.error(`❌ Unexpected response (${response.status})`);
                return;
            }

            toast.success('✅ Added successfully');
            setNewItem(initialItem);
            setAddErrors({});
            setShowAddModal(false);
            fetchItems();

        } catch (err) {
            if (err.response?.data) {
                const apiErrors = err.response.data;
                setAddErrors(apiErrors);

                const nonFieldErrors = Object.entries(apiErrors)
                    .filter(([key]) => !fields.some((f) => f.name === key))
                    .map(([_, val]) => Array.isArray(val) ? val.join(', ') : val)
                    .join('; ');

                toast.error(nonFieldErrors || '❌ Please fix validation errors.');
            } else {
                toast.error(`❌ ${err.message || 'Failed to add item'}`);
            }
        } finally {
            setAdding(false); // Done loading
        }
    };


    return (
        <Container className="mt-4">
            <ListControls
                title={title.toUpperCase()}
                search={search}
                setSearch={setSearch}
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
            /> </Container>
    );
};

export default GenericList;
