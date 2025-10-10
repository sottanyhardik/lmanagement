// src/pages/Allotment/forms/AllotmentMakeForm.jsx
import React, {useEffect, useState} from 'react';
import AllotmentLineItemTable from '../components/AllotmentLineItemTable.jsx';


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

    // Keep local rows in sync when parent entry updates (e.g., after adding via search)
    useEffect(() => {
        setItems(normalizeLines(entry));
        // reset field errors when entry refreshes
        setErrors({});
    }, [entry?.id, entry?.allotment_details]);

    const defaultItemName = entry?.item_name ?? '';
    const unitPrice = entry?.unit_value_per_unit ?? 0;
    const requiredQuantity = entry?.required_quantity ?? 0;
    const requiredValue = entry?.required_cif_fc ?? 0; // if present on the model/serializer

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
        setItems((prev) => [
            ...prev,
            {id: null, sr_number: null, qty: '', cif_fc: '', cif_inr: '', is_boe: false},
        ]);

    const removeRow = (idx) => {
        const updated = [...items];
        updated.splice(idx, 1);
        if (updated.length === 0) {
            updated.push({id: null, sr_number: null, qty: '', cif_fc: '', cif_inr: '', is_boe: false});
        }
        setItems(updated);
    };

    return (
        <>
            <AllotmentLineItemTable
                // top table (existing lines)
                items={items}
                errors={errors}
                onItemChange={handleItemChange}
                onAddRow={addRow}
                onRemoveRow={removeRow}
                // search table helpers
                defaultItemName={defaultItemName}
                unitPrice={unitPrice}
                requiredQuantity={requiredQuantity}
                requiredValue={requiredValue}
                // for API creation on "Allot" click in the search table
                allotmentId={entry?.id}
                onSaved={onSaved}
            />
        </>
    );
};

export default AllotmentMakeForm;
