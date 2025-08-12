// src/pages/Allotment/tabs/AllotmentTLTab.jsx
import React from 'react';
import TransferLetterFromAllotment from '../TransferLetterFromAllotment';

const AllotmentTLTab = ({entry}) => {
    // Hand entity as-is; TL form will read company/port/id from here
    const prefill = {
        items: (entry?.allotment_details || []).map((d, idx) => ({
            id: d.id || idx,
            // Use the nice display name if present, fall back to license + SR
            sr_number:
                d?.item?.display_name ||
                `${d.license_number || ''} - S${d.serial_number || ''}`.trim(),
            cif_fc: Number(d.cif_fc || 0),
        })),
    };

    return (
        <div className="border rounded p-3 bg-light">
            <TransferLetterFromAllotment
                context="allotment"
                entity={entry}      // <-- the whole allotment
                prefill={prefill}   // <-- rows for quick edit
                autoDownload        // optional: auto open download if API returns url
            />
        </div>
    );
};

export default AllotmentTLTab;
