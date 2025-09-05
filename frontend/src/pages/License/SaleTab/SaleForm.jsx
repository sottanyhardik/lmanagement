import React from "react";
import LicenseInvoiceForm from "../sale/LicenseInvoiceForm";

export default function SaleForm({entry, onSaved, saleType, fullBasis}) {
    return (
        <div className="border rounded p-3 mb-3 bg-light">
            <LicenseInvoiceForm
                entry={entry}
                onSaved={onSaved}
                saleType={saleType}
                fullBasis={fullBasis}
            />
        </div>
    );
}
