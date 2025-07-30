import React from 'react';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';

const DeleteSelectedButton = ({selectedIds, onDeleted}) => {
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} entries?`)) return;

        try {
            await axios.post('/api/bill-of-entries/bulk-delete/', {ids: selectedIds});
            toast.success('Selected entries deleted');
            onDeleted();
        } catch (err) {
            toast.error('Failed to delete selected entries');
        }
    };

    return (
        selectedIds.length > 0 && (
            <div className="d-flex justify-content-end mb-2">
                <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
                    Delete Selected ({selectedIds.length})
                </button>
            </div>
        )
    );
};

export default DeleteSelectedButton;
