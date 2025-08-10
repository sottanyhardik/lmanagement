// ExportLicenseTable.jsx
import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {Button, Form, InputGroup, Table} from 'react-bootstrap';
import AsyncNormSelect from '../../components/AsyncNormSelect';

/**
 * ExportLicenseTable
 *
 * Renders Export items and, per row, a SION Norm selector with:
 *  - Start Serial input
 *  - "Fetch Now" button to trigger prefilling of import items in the parent
 *
 * Props
 * - exportItems: Array of Export item rows
 * - onChange: (updatedRows) => void
 * - onAdd: () => void
 * - onFetchSionInputs: ({ normClass, startSerial, rowIndex }) => Promise<void>
 */
const ExportLicenseTable = ({
                                exportItems = [],
                                onChange,
                                onAdd,
                                onFetchSionInputs,
                            }) => {
    // Per-row UI state: startSerial + loading
    const [rowState, setRowState] = useState(() =>
        exportItems.map(() => ({startSerial: 1, loading: false}))
    );

    // Keep rowState length in sync with exportItems
    useEffect(() => {
        setRowState(prev => {
            const next = [...prev];
            // extend
            while (next.length < exportItems.length) next.push({startSerial: 1, loading: false});
            // shrink
            return next.slice(0, exportItems.length);
        });
    }, [exportItems.length]);

    const updateRow = (index, patch) => {
        const updated = [...exportItems];
        updated[index] = {...updated[index], ...patch};
        onChange?.(updated);
    };

    const handleFieldChange = (index, field, value) => {
        updateRow(index, {[field]: value});
    };

    const handleStartSerialChange = (index, raw) => {
        const digitsOnly = String(raw).replace(/[^\d]/g, '');
        const parsed = digitsOnly === '' ? '' : Number(digitsOnly);
        setRowState(prev => {
            const next = [...prev];
            next[index] = {...next[index], startSerial: parsed};
            return next;
        });
    };

    const handleFetch = async (index) => {
        if (!onFetchSionInputs) return;

        const item = exportItems[index];
        const {startSerial} = rowState[index] || {};
        const normClass = item?.norm_class ?? null;

        if (!normClass) return; // guard: require a norm selected
        const sr = Number(startSerial);
        if (!Number.isInteger(sr) || sr < 1) return; // guard: 1+

        setRowState(prev => {
            const next = [...prev];
            next[index] = {...next[index], loading: true};
            return next;
        });

        try {
            await onFetchSionInputs({normClass, startSerial: sr, rowIndex: index});
        } finally {
            setRowState(prev => {
                const next = [...prev];
                next[index] = {...next[index], loading: false};
                return next;
            });
        }
    };

    return (
        <>
            <h6 className="mt-4">Export Items</h6>
            <Table size="sm" bordered>
                <thead>
                <tr>
                    <th>Net Qty</th>
                    <th>Unit</th>
                    <th>Currency</th>
                    <th>CIF FC</th>
                    <th>CIF INR</th>
                    <th style={{minWidth: 300}}>SION Norm & Prefill</th>
                </tr>
                </thead>
                <tbody>
                {exportItems.map((item, i) => {
                    const {startSerial = 1, loading = false} = rowState[i] || {};
                    return (
                        <tr key={i}>
                            <td>
                                <Form.Control
                                    value={item.net_quantity ?? ''}
                                    onChange={e => handleFieldChange(i, 'net_quantity', e.target.value)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    value={item.unit ?? ''}
                                    onChange={e => handleFieldChange(i, 'unit', e.target.value)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    value={item.currency ?? ''}
                                    onChange={e => handleFieldChange(i, 'currency', e.target.value)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    value={item.cif_fc ?? ''}
                                    onChange={e => handleFieldChange(i, 'cif_fc', e.target.value)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    value={item.cif_inr ?? ''}
                                    onChange={e => handleFieldChange(i, 'cif_inr', e.target.value)}
                                />
                            </td>
                            <td>
                                <div className="d-flex flex-column gap-2">
                                    <AsyncNormSelect
                                        value={item.norm_class ?? null}
                                        onChange={v => handleFieldChange(i, 'norm_class', v)}
                                        placeholder="Select SION Norm"
                                    />
                                    <InputGroup size="sm">
                                        <InputGroup.Text>Start Serial</InputGroup.Text>
                                        <Form.Control
                                            aria-label="Start Serial"
                                            value={startSerial}
                                            onChange={e => handleStartSerialChange(i, e.target.value)}
                                            inputMode="numeric"
                                            min={1}
                                        />
                                        <Button
                                            variant="outline-primary"
                                            disabled={!item.norm_class || loading || !startSerial}
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

            <Button size="sm" variant="primary" onClick={onAdd}>
                + Add Export Item
            </Button>
        </>
    );
};

ExportLicenseTable.propTypes = {
    exportItems: PropTypes.arrayOf(
        PropTypes.shape({
            net_quantity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            unit: PropTypes.string,
            currency: PropTypes.string,
            cif_fc: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            cif_inr: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            norm_class: PropTypes.any, // typically { id/value, label } or a PK
        })
    ),
    onChange: PropTypes.func,
    onAdd: PropTypes.func,
    onFetchSionInputs: PropTypes.func, // async
};

export default ExportLicenseTable;
