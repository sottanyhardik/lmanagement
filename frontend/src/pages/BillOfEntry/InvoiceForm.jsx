// src/pages/BOE/InvoiceForm.jsx
import React from 'react';
import TradeInvoiceCore from '../../components/trade/TradeInvoiceCore.jsx';

const InvoiceForm = ({boe, onSaved}) => {
    // SALE-only flow, seed from this BOE, and show selector of existing SALE trades for this BOE
    return <TradeInvoiceCore mode="SALE" boe={boe} fetchByBoe onSaved={onSaved}/>;
};

export default InvoiceForm;
