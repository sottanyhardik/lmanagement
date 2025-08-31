import React from "react";
import TransferLetterFromAllotment from "../TransferLetterFromAllotment";

const AllotmentTLTab = ({entry}) => {
    return (
        <div className="border rounded p-3 bg-light">
            <TransferLetterFromAllotment
                allotment={entry}
                autoDownload
            />
        </div>
    );
};

export default AllotmentTLTab;
