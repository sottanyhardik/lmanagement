// src/pages/Trade/TradeForm.jsx
import React from "react";
import TradeInvoiceCore from "../../components/trade/TradeInvoiceCore.jsx";

/**
 * Wrapper around the generic core.
 * If you need to pass an initialTrade (editing) or a BOE (for SALE),
 * provide them via the parent when you render this page.
 */
const TradeForm = ({entry, isNew = false, onClose, onSaved}) => {
    const mode = entry?.direction || "PURCHASE";
    const boe = entry?.boe || null;
    const fetchByBoe = !!boe;

    return (
        <div>
            <TradeInvoiceCore
                mode={mode}
                boe={boe}
                initialTrade={entry?.id ? entry : null}
                fetchByBoe={fetchByBoe}
                onSaved={onSaved}
            />
            {onClose && (
                <div className="mt-2">
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

export default TradeForm;
