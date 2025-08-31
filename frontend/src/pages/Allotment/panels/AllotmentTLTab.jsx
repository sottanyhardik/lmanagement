// src/pages/Allotment/tabs/AllotmentTLTab.jsx
import React from "react";
import TransferLetterFromAllotment from "../TransferLetterFromAllotment";

const AllotmentTLTab = ({entry}) => {
    const prefill = {
        items: (entry?.allotment_details || []).map((d, idx) => ({
            id: d.id || idx,
            sr_number: d?.item?.display_name || `${d.license_number || ""} - S${d.serial_number || ""}`.trim(),
            cif_fc: Number(d.cif_fc || 0),
        })),
    };

    return (
        <div className="border rounded p-3 bg-light">
            <TransferLetterFromAllotment
                context="allotment"
                entity={entry}
                prefill={prefill}
                autoDownload
            />
        </div>
    );
};

export default AllotmentTLTab;
