// components/LineItemTable.jsx
import React, {useEffect, useRef} from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncSrNumberSelect from './AsyncSrNumberSelect';

const LineItemTable = ({
                           items,
                           errors = {},
                           selectedSrNumbers = [],
                           onItemChange,
                           onAddRow,
                           onRemoveRow
                       }) => {
    const lastRowRef = useRef();

    useEffect(() => {
        if (lastRowRef.current) {
            lastRowRef.current.focus();
        }
    }, [items.length]);

    const totalQuantity = items.reduce((sum, row) => sum + parseFloat(row.qty || 0), 0);
    const totalCifInr = items.reduce((sum, row) => sum + parseFloat(row.cif_inr || 0), 0);
    const totalCifUsd = items.reduce((sum, row) => sum + parseFloat(row.cif_fc || 0), 0);

    return (
        <>
            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>SR No Display</th>
                    <th>Qty</th>
                    <th>CIF FC</th>
                    <th>CIF INR</th>
                    <th></th>
                </tr>
                </thead>
                <tbody>
                {items.map((item, idx) => {
                    const isDuplicate = selectedSrNumbers.filter(v => v === item.sr_number?.value).length > 1;
                    return (
                        <tr key={idx} className={isDuplicate ? 'bg-danger bg-opacity-25' : ''}>
                            <td>
                                <AsyncSrNumberSelect
                                    value={item.sr_number ?? ""}
                                    onChange={(selected) => onItemChange(idx, 'sr_number', selected)}
                                    excludeIds={selectedSrNumbers.filter(id => id !== item.sr_number?.id)}
                                />
                                <Form.Control.Feedback type="invalid">{errors[`item_${idx}_sr`]}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Form.Control
                                    ref={idx === items.length - 1 ? lastRowRef : null}
                                    size="sm"
                                    value={item.qty ?? ""}
                                    isInvalid={!!errors[`item_${idx}_qty`]}
                                    onChange={(e) => onItemChange(idx, 'qty', e.target.value)}
                                />
                                <Form.Control.Feedback
                                    type="invalid">{errors[`item_${idx}_qty`]}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Form.Control
                                    size="sm"
                                    value={item.cif_fc ?? ""}
                                    isInvalid={!!errors[`item_${idx}_fc`]}
                                    onChange={(e) => onItemChange(idx, 'cif_fc', e.target.value)}
                                />
                                <Form.Control.Feedback type="invalid">{errors[`item_${idx}_fc`]}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Form.Control
                                    size="sm"
                                    value={item.cif_inr ?? ""}
                                    isInvalid={!!errors[`item_${idx}_inr`]}
                                    onChange={(e) => onItemChange(idx, 'cif_inr', e.target.value)}
                                />
                                <Form.Control.Feedback
                                    type="invalid">{errors[`item_${idx}_inr`]}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => onRemoveRow(idx)}
                                    disabled={items.length === 1}
                                >
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    );
                })}
                <tr className="table-light">
                    <td><strong>Totals</strong></td>
                    <td><strong>{totalQuantity}</strong></td>
                    <td><strong>{totalCifUsd.toLocaleString(undefined, {maximumFractionDigits: 2})}</strong></td>
                    <td><strong>{totalCifInr.toLocaleString(undefined, {maximumFractionDigits: 2})}</strong></td>
                    <td></td>
                </tr>
                </tbody>
            </Table>
            <Button size="sm" variant="outline-primary" onClick={onAddRow}>+ Add Item</Button>
        </>
    );
};

export default LineItemTable;
