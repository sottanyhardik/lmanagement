// src/pages/License/ExportLicenseTable.jsx
import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {Button, Form, InputGroup, Table} from 'react-bootstrap';
import AsyncNormSelect from '../../components/AsyncSelect/AsyncNormSelect';

const ExportLicenseTable = ({
                                exportItems = [],
                                onChange,
                                onAdd,
                                onFetchSionInputs,
                                errors = {},
                                disabled = false,
                            }) => {
    const [rowState, setRowState] = useState(() =>
        exportItems.map(() => ({startSerial: 1, loading: false}))
    );

    useEffect(() => {
        setRowState(prev => {
            const next = [...prev];
            while (next.length < exportItems.length) next.push({startSerial: 1, loading: false});
            return next.slice(0, exportItems.length);
        });
    }, [exportItems.length]);

    const updateRow = (index, patch) => {
        const updated = [...exportItems];
        updated[index] = {...(updated[index] || {}), ...patch};
        onChange?.(updated);
    };

    const handleFieldChange = (i, field, value) => updateRow(i, {[field]: value});

    const handleStartSerialChange = (i, raw) => {
        const digitsOnly = String(raw).replace(/[^\d]/g, '');
        const parsed = digitsOnly === '' ? '' : Number(digitsOnly);
        setRowState(prev => {
            const next = [...prev];
            next[i] = {...(next[i] || {}), startSerial: parsed};
            return next;
        });
    };

    const handleFetch = async (i) => {
        if (!onFetchSionInputs) return;
        const item = exportItems[i];
        const {startSerial} = rowState[i] || {};
        const normClass = item?.norm_class ?? null;
        const sr = Number(startSerial);
        if (!normClass || !Number.isInteger(sr) || sr < 1) return;

        setRowState(prev => {
            const next = [...prev];
            next[i] = {...(next[i] || {}), loading: true};
            return next;
        });

        try {
            await onFetchSionInputs({normClass, startSerial: sr, rowIndex: i});
        } finally {
            setRowState(prev => {
                const next = [...prev];
                next[i] = {...(next[i] || {}), loading: false};
                return next;
            });
        }
    };

    const getErr = (i, key) =>
        errors?.[`export_license.${i}.${key}`] ||
        errors?.[`export_norm.${i}.${key}`] ||
        '';

    const invalidWrapCls = (hasErr) => (hasErr ? 'is-invalid' : '');

    return (
        <>
            <h6 className="mt-4">Export Items</h6>
            <Table size="sm" bordered responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th>Net Qty</th>
                    <th>Unit</th>
                    <th>Currency</th>
                    <th className="text-end">CIF FC</th>
                    <th className="text-end">CIF INR</th>
                    <th style={{minWidth: 320}}>SION Norm & Prefill</th>
                </tr>
                </thead>
                <tbody>
                {exportItems.map((item, i) => {
                    const {startSerial = 1, loading = false} = rowState[i] || {};
                    const errQty = getErr(i, 'net_quantity');
                    const errUnit = getErr(i, 'unit');
                    const errCurr = getErr(i, 'currency');
                    const errFc = getErr(i, 'cif_fc');
                    const errInr = getErr(i, 'cif_inr');
                    const errNorm = getErr(i, 'norm_class_id') || getErr(i, 'norm_class');

                    return (
                        <tr key={item?.id ?? i}>
                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    value={item.net_quantity ?? ''}
                                    onChange={e => handleFieldChange(i, 'net_quantity', e.target.value)}
                                    isInvalid={!!errQty}
                                    disabled={disabled}
                                    placeholder="0.0000"
                                    step="0.0001"
                                    min="0"
                                    aria-describedby={`err-exp-qty-${i}`}
                                />
                                <Form.Control.Feedback type="invalid" id={`err-exp-qty-${i}`}>
                                    {errQty}
                                </Form.Control.Feedback>
                            </td>

                            <td>
                                <Form.Control
                                    size="sm"
                                    value={item.unit ?? ''}
                                    onChange={e => handleFieldChange(i, 'unit', e.target.value)}
                                    isInvalid={!!errUnit}
                                    disabled={disabled}
                                    placeholder="kg"
                                    aria-describedby={`err-exp-unit-${i}`}
                                />
                                <Form.Control.Feedback type="invalid" id={`err-exp-unit-${i}`}>
                                    {errUnit}
                                </Form.Control.Feedback>
                            </td>

                            <td>
                                <Form.Control
                                    size="sm"
                                    value={item.currency ?? ''}
                                    onChange={e => handleFieldChange(i, 'currency', e.target.value)}
                                    isInvalid={!!errCurr}
                                    disabled={disabled}
                                    placeholder="usd"
                                    aria-describedby={`err-exp-currency-${i}`}
                                />
                                <Form.Control.Feedback type="invalid" id={`err-exp-currency-${i}`}>
                                    {errCurr}
                                </Form.Control.Feedback>
                            </td>

                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={item.cif_fc ?? ''}
                                    onChange={e => handleFieldChange(i, 'cif_fc', e.target.value)}
                                    isInvalid={!!errFc}
                                    disabled={disabled}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    aria-describedby={`err-exp-ciffc-${i}`}
                                />
                                <Form.Control.Feedback
                                    type="invalid"
                                    className="text-end d-block"
                                    id={`err-exp-ciffc-${i}`}
                                >
                                    {errFc}
                                </Form.Control.Feedback>
                            </td>

                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={item.cif_inr ?? ''}
                                    onChange={e => handleFieldChange(i, 'cif_inr', e.target.value)}
                                    isInvalid={!!errInr}
                                    disabled={disabled}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    aria-describedby={`err-exp-cifinr-${i}`}
                                />
                                <Form.Control.Feedback
                                    type="invalid"
                                    className="text-end d-block"
                                    id={`err-exp-cifinr-${i}`}
                                >
                                    {errInr}
                                </Form.Control.Feedback>
                            </td>

                            <td>
                                <div className="d-flex flex-column gap-2">
                                    <div className={invalidWrapCls(!!errNorm)}>
                                        <AsyncNormSelect
                                            classNamePrefix="react-select"
                                            value={item?.norm_class ?? null}
                                            onChange={(v) => {
                                                if (!v) {
                                                    updateRow(i, {norm_class: null, norm_class_id: null});
                                                    return;
                                                }
                                                const normOption = {
                                                    id: v.id ?? v.value ?? null,
                                                    value: (v.value ?? v.id ?? null),
                                                    label: v.label ?? v.norm_class ?? v.name ?? String(v.id ?? v.value ?? ''),
                                                };
                                                updateRow(i, {
                                                    norm_class: normOption,
                                                    norm_class_id: normOption.id,
                                                });
                                            }}
                                            isDisabled={disabled}
                                            placeholder="Select SION norm…"
                                        />
                                    </div>
                                    {errNorm && (
                                        <div className="invalid-feedback d-block" id={`err-exp-norm-${i}`}>
                                            {errNorm}
                                        </div>
                                    )}

                                    <InputGroup size="sm">
                                        <InputGroup.Text>Start Serial</InputGroup.Text>
                                        <Form.Control
                                            type="number"
                                            aria-label="Start Serial"
                                            value={startSerial}
                                            onChange={e => handleStartSerialChange(i, e.target.value)}
                                            min={1}
                                            disabled={disabled}
                                        />
                                        <Button
                                            variant="outline-primary"
                                            disabled={disabled || !item?.norm_class || loading || !startSerial}
                                            onClick={() => handleFetch(i)}
                                        >
                                            {loading ? 'Fetching…' : 'Fetch Now'}
                                        </Button>
                                    </InputGroup>
                                </div>
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </Table>

            <Button size="sm" variant="primary" onClick={onAdd} disabled={disabled}>
                + Add Export Item
            </Button>
        </>
    );
};

ExportLicenseTable.propTypes = {
    exportItems: PropTypes.arrayOf(PropTypes.object),
    onChange: PropTypes.func,
    onAdd: PropTypes.func,
    onFetchSionInputs: PropTypes.func,
    errors: PropTypes.object,
    disabled: PropTypes.bool,
};

export default ExportLicenseTable;
