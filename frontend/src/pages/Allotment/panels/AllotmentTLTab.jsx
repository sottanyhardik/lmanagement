import React from 'react';
import TransferLetterForm from '../../BillOfEntry/TransferLetterForm';

const AllotmentTLTab = ({entry}) => {
    // Build a minimal BOE-like object expected by your TL form
    const boeLike = {
        company: entry?.company || null,
        port: entry?.port || null,
    };

    const prefill = {
        items: (entry?.allotment_details || []).map((d) => ({
            sr_number: d.item
                ? {value: d.item.id, label: d.item.display_name}
                : {value: null, label: `${d.license_number} - ${d.serial_number}`},
            qty: d.qty || 0,
            cif_fc: d.cif_fc || 0,
            cif_inr: d.cif_inr || 0,
        })),
    };

    return (
        <div className="border rounded p-3 bg-light">
            <TransferLetterForm boe={boeLike} prefill={prefill}/>
        </div>
    );
};

export default AllotmentTLTab;
