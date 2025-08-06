import React from 'react';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';

const DeleteSelectedLicensesButton = ({selectedIds, onDeleted}) => {
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} license(s)?`)) return;

        try {
            await axios.post('/api/licenses/bulk-delete/', {ids: selectedIds});
            toast.success('Selected licenses deleted');
            onDeleted();
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete selected licenses');
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

export default DeleteSelectedLicensesButton;
