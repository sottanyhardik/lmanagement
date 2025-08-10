import React, {useState} from 'react';
import {Button} from 'react-bootstrap';
import axios from '../../../api/axiosInstance';
import {toast} from 'react-toastify';
import AllotmentLineItemTable from '../parts/AllotmentLineItemTable';

const normalizeLines = (entry) =>
    (entry?.allotment_details || []).map((d) => ({
        id: d.id || null,
        sr_number: d.item
            ? {value: d.item.id, label: d.item.display_name}
            : {value: null, label: ''},
        qty: d.qty ?? '',
        cif_fc: d.cif_fc ?? '',
        cif_inr: d.cif_inr ?? '',
        is_boe: !!d.is_boe,
    }));

const AllotmentMakeForm = ({entry, onSaved}) => {
    const [items, setItems] = useState(() => normalizeLines(entry));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const handleItemChange = (idx, field, value) => {
        const updated = [...items];
        updated[idx] = {...updated[idx], [field]: value};
        setItems(updated);
        setErrors((prev) => {
            const n = {...prev};
            delete n[`item_${idx}_${field}`];
            return n;
        });
    };

    const addRow = () =>
        setItems((prev) => [...prev, {id: null, sr_number: null, qty: '', cif_fc: '', cif_inr: '', is_boe: false}]);

    const removeRow = (idx) => {
        const updated = [...items];
        updated.splice(idx, 1);
        if (updated.length === 0) updated.push({
            id: null,
            sr_number: null,
            qty: '',
            cif_fc: '',
            cif_inr: '',
            is_boe: false
        });
        setItems(updated);
    };

    const validate = () => {
        const errs = {};
        (items || []).forEach((it, i) => {
            const sr = it.sr_number?.value;
            if (!sr) errs[`item_${i}_sr`] = 'License Item is required';
            if (!it.qty || isNaN(it.qty) || Number(it.qty) <= 0) errs[`item_${i}_qty`] = 'Invalid qty';
            if (it.cif_fc && isNaN(it.cif_fc)) errs[`item_${i}_fc`] = 'Invalid';
            if (it.cif_inr && isNaN(it.cif_inr)) errs[`item_${i}_inr`] = 'Invalid';
        });
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const save = async () => {
        if (!validate()) return toast.error('Please fix validation errors');
        setSaving(true);
        try {
            // upsert by id; backend deletes rows not present in payload
            const payload = {
                allotment_details: items.map((d) => ({
                    id: d.id || undefined,                   // keep to update existing rows
                    item_id: d.sr_number?.value || null,
                    qty: d.qty ? Number(d.qty) : 0,
                    cif_fc: d.cif_fc ? Number(d.cif_fc) : 0,
                    cif_inr: d.cif_inr ? Number(d.cif_inr) : 0,
                    is_boe: !!d.is_boe,
                })),
            };
            await axios.patch(`/api/allotments/${entry.id}/`, payload);
            toast.success('Allotment lines updated');
            onSaved?.();
        } catch (e) {
            const apiErrors = e.response?.data;
            if (apiErrors) setErrors(apiErrors);
            toast.error('Failed to update lines');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <AllotmentLineItemTable
                items={items}
                errors={errors}
                onItemChange={handleItemChange}
                onAddRow={addRow}
                onRemoveRow={removeRow}
            />
            <Button size="sm" variant="success" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save Lines'}
            </Button>
        </>
    );
};

export default AllotmentMakeForm;
