import React, {useState} from "react";
import SaleTable from "./SaleTable";
import SaleForm from "./SaleForm";
import SaleControls from "./components/SaleControls.jsx";

export default function SaleTab({entry, onSaved}) {
    const [showForm, setShowForm] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [saleType, setSaleType] = useState("item");      // "item" | "full"
    const [fullBasis, setFullBasis] = useState("cif_inr"); // only when saleType === "full"

    const invoices = entry?.invoices || [];

    const openCreate = () => {
        setEditingInvoice(null);
        setShowForm(true);
    };

    const openEdit = (inv) => {
        setEditingInvoice(inv);
        setShowForm(true);
    };

    const handleSaved = () => {
        setShowForm(false);
        setEditingInvoice(null);
        onSaved && onSaved(entry.id);
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Sales</h6>
                <SaleControls
                    saleType={saleType}
                    onSaleTypeChange={setSaleType}
                    fullBasis={fullBasis}
                    onFullBasisChange={setFullBasis}
                    onAddNew={openCreate}
                />
            </div>

            {showForm && (
                <SaleForm
                    // create => force clean entry (no invoices); edit => inject selected invoice
                    entry={
                        editingInvoice
                            ? {...entry, invoices: [editingInvoice]}
                            : {...entry, invoices: []}
                    }
                    onSaved={handleSaved}
                    saleType={saleType}
                    fullBasis={fullBasis}
                />
            )}

            <SaleTable invoices={invoices} onEdit={openEdit}/>
        </div>
    );
}
