import React from "react";
import {Button, Form} from "react-bootstrap";

export default function SaleControls({
                                         saleType,
                                         onSaleTypeChange,
                                         fullBasis,
                                         onFullBasisChange,
                                         onAddNew,
                                     }) {
    return (
        <div className="d-flex align-items-center gap-3">
            <Form.Select size="sm" value={saleType} onChange={(e) => onSaleTypeChange(e.target.value)}>
                <option value="item">Sell by Item</option>
                <option value="full">Sell Full License</option>
            </Form.Select>

            {saleType === "full" && (
                <Form.Select size="sm" value={fullBasis} onChange={(e) => onFullBasisChange(e.target.value)}>
                    <option value="cif_inr">Basis: CIF INR</option>
                    <option value="fob_inr">Basis: FOB INR</option>
                </Form.Select>
            )}

            <Button size="sm" onClick={onAddNew}>Add New</Button>
        </div>
    );
}
