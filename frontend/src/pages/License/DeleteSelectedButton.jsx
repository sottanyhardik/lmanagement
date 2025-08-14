// pages/License/DeleteSelectedButton.jsx
import React, {useState} from 'react';
import {Button, Spinner} from 'react-bootstrap';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';

const DeleteSelectedButton = ({
                                  selectedIds = [],
                                  onDeleted,
                                  resourceBase = 'licenses', // reuse for other resources if needed
                                  size = 'sm',
                                  className = '',
                              }) => {
    const [busy, setBusy] = useState(false);

    if (!selectedIds.length) return null;

    const plural = selectedIds.length > 1 ? 's' : '';

    const tryBulkDelete = async () => {
        // Many DRF setups accept DELETE with body at a custom action
        // axios supports body via the `data` key in the config
        return axios.delete(`${resourceBase}/bulk-delete/`, {
            data: {ids: selectedIds},
        });
    };

    const fallbackPerItemDelete = async () => {
        const results = await Promise.allSettled(
            selectedIds.map((id) => axios.delete(`${resourceBase}/${id}/`))
        );
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length) {
            toast.error(`Failed to delete ${failed.length} of ${selectedIds.length} item${plural}.`);
        } else {
            toast.success(`Deleted ${selectedIds.length} item${plural}.`);
        }
    };

    const handleBulkDelete = async () => {
        if (busy) return;
        if (!window.confirm(`Delete ${selectedIds.length} license${plural}?`)) return;

        setBusy(true);
        try {
            await tryBulkDelete();
            toast.success(`Deleted ${selectedIds.length} license${plural}.`);
            onDeleted?.();
        } catch (err) {
            const status = err?.response?.status;
            if (status === 405 || status === 404) {
                // Bulk endpoint/method not available — fall back
                try {
                    await fallbackPerItemDelete();
                    onDeleted?.();
                } catch (innerErr) {
                    console.error(innerErr);
                    toast.error('Bulk delete failed.');
                }
            } else {
                const msg =
                    err?.response?.data?.detail ||
                    err?.message ||
                    'Failed to delete selected licenses.';
                toast.error(msg);
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="d-flex justify-content-end mb-2">
            <Button
                variant="danger"
                size={size}
                onClick={handleBulkDelete}
                disabled={busy}
                className={className}
            >
                {busy ? (
                    <>
                        <Spinner as="span" animation="border" size="sm" className="me-2"/>
                        Deleting…
                    </>
                ) : (
                    <>Delete Selected ({selectedIds.length})</>
                )}
            </Button>
        </div>
    );
};

export default DeleteSelectedButton;
