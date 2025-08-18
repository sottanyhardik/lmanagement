// src/pages/License/ImportLicenseTable.jsx
import React from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncHSCodeSelect from '../../components/AsyncSelect/AsyncHSCodeSelect';
import AsyncItemSelect from '../../components/AsyncSelect/AsyncItemSelect';

/**
 * @param {Array}  importItems
 * @param {Function} onChange
 * @param {Function} onAdd
 * @param {Function} onRemove
 * @param {Object}  errors
 * @param {boolean} disabled
 */
const ImportLicenseTable = ({
                                importItems = [],
                                onChange,
                                onAdd,
                                onRemove,
                                errors = {},
                                disabled = false,
                            }) => {
    const updateRows = (next) => onChange?.(next);

    const handleField = (i, field, value) => {
        const next = [...importItems];
        next[i] = {...(next[i] || {}), [field]: value};
        updateRows(next);
    };

    const addRow = () => {
        if (typeof onAdd === 'function') return onAdd();
        updateRows([
            ...importItems,
            {
                serial_number: '',
                hs_code: null,
                items: [],
                description: '',
                quantity: '',
                unit: '',
                cif_fc: '',
                cif_inr: ''
            },
        ]);
    };

    const removeRow = (i) => {
        if (typeof onRemove === 'function') return onRemove(i);
        const next = [...importItems];
        next.splice(i, 1);
        updateRows(next);
    };

    const getErr = (i, key) =>
        errors?.[`import_license.${i}.${key}`] ||
        errors?.[`import_norm.${i}.${key}`] ||
        '';

    return (
        <>
            <h6 className="mt-4">Import Items</h6>
            <Table size="sm" bordered responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th style={{width: 90}}>Serial No</th>
                    <th style={{minWidth: 180}}>HS Code</th>
                    <th style={{minWidth: 220}}>Items</th>
                    <th style={{minWidth: 260}}>Description</th>
                    <th className="text-end" style={{minWidth: 120}}>Qty</th>
                    <th style={{width: 100}}>Unit</th>
                    <th className="text-end" style={{minWidth: 140}}>CIF FC</th>
                    <th className="text-end" style={{minWidth: 140}}>CIF INR</th>
                    <th style={{width: 80}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {importItems.map((item, i) => {
                    const idKey = item?.id ?? i;
                    return (
                        <tr key={idKey}>
                            <td>
                                <Form.Control size="sm" value={item?.serial_number ?? ''}
                                              onChange={(e) => handleField(i, 'serial_number', e.target.value)}
                                              isInvalid={!!getErr(i, 'serial_number')} disabled={disabled}
                                              placeholder="SR"/>
                                <Form.Control.Feedback
                                    type="invalid">{getErr(i, 'serial_number')}</Form.Control.Feedback>
                            </td>
                            <td>
                                <AsyncHSCodeSelect value={item?.hs_code ?? null}
                                                   onChange={(v) => handleField(i, 'hs_code', v)}
                                                   isInvalid={!!getErr(i, 'hs_code')} isDisabled={disabled}
                                                   placeholder="Select HS code…"/>
                                {getErr(i, 'hs_code') &&
                                    <div className="invalid-feedback d-block">{getErr(i, 'hs_code')}</div>}
                            </td>
                            <td>
                                <AsyncItemSelect value={Array.isArray(item?.items) ? item.items : []}
                                                 onChange={(v) => handleField(i, 'items', v || [])} isMulti
                                                 isDisabled={disabled} placeholder="Select item(s)…"/>
                                {getErr(i, 'items') &&
                                    <div className="invalid-feedback d-block">{getErr(i, 'items')}</div>}
                            </td>
                            <td>
                                <Form.Control as="textarea" rows={2} size="sm" value={item?.description ?? ''}
                                              onChange={(e) => handleField(i, 'description', e.target.value)}
                                              isInvalid={!!getErr(i, 'description')} disabled={disabled}
                                              placeholder="Description"/>
                                <Form.Control.Feedback type="invalid">{getErr(i, 'description')}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Form.Control type="number" size="sm" className="text-end" value={item?.quantity ?? ''}
                                              onChange={(e) => handleField(i, 'quantity', e.target.value)}
                                              isInvalid={!!getErr(i, 'quantity')} disabled={disabled} placeholder="0.00"
                                              step="0.0001" min="0"/>
                                <Form.Control.Feedback type="invalid"
                                                       className="text-end d-block">{getErr(i, 'quantity')}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Form.Control size="sm" value={item?.unit ?? ''}
                                              onChange={(e) => handleField(i, 'unit', e.target.value)}
                                              isInvalid={!!getErr(i, 'unit')} disabled={disabled} placeholder="Unit"/>
                                <Form.Control.Feedback type="invalid">{getErr(i, 'unit')}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Form.Control type="number" size="sm" className="text-end" value={item?.cif_fc ?? ''}
                                              onChange={(e) => handleField(i, 'cif_fc', e.target.value)}
                                              isInvalid={!!getErr(i, 'cif_fc')} disabled={disabled} placeholder="0.00"
                                              step="0.01" min="0"/>
                                <Form.Control.Feedback type="invalid"
                                                       className="text-end d-block">{getErr(i, 'cif_fc')}</Form.Control.Feedback>
                            </td>
                            <td>
                                <Form.Control type="number" size="sm" className="text-end" value={item?.cif_inr ?? ''}
                                              onChange={(e) => handleField(i, 'cif_inr', e.target.value)}
                                              isInvalid={!!getErr(i, 'cif_inr')} disabled={disabled} placeholder="0.00"
                                              step="0.01" min="0"/>
                                <Form.Control.Feedback type="invalid"
                                                       className="text-end d-block">{getErr(i, 'cif_inr')}</Form.Control.Feedback>
                            </td>
                            <td className="text-center">
                                <Button size="sm" variant="outline-danger" onClick={() => removeRow(i)}
                                        disabled={disabled}>Remove</Button>
                            </td>
                        </tr>
                    );
                })}
                {!importItems.length && (
                    <tr>
                        <td colSpan={9} className="text-center text-muted py-3">No import items added yet.</td>
                    </tr>
                )}
                </tbody>
            </Table>
            <Button size="sm" variant="primary" onClick={addRow} disabled={disabled}>+ Add Import Item</Button>
        </>
    );
};

export default ImportLicenseTable;
