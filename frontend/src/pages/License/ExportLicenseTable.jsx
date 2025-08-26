// src/pages/License/ExportLicenseTable.jsx
import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {Button, Form, InputGroup, Table} from 'react-bootstrap';
import AsyncNormSelect from '../../components/AsyncSelect/AsyncNormSelect';

const ExportLicenseTable = ({exportItems = [], onChange, onAdd, onFetchSionInputs}) => {
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
        updated[index] = {...updated[index], ...patch};
        onChange?.(updated);
    };

    const handleFieldChange = (i, field, value) => updateRow(i, {[field]: value});

    const handleStartSerialChange = (i, raw) => {
        const digitsOnly = String(raw).replace(/[^\d]/g, '');
        const parsed = digitsOnly === '' ? '' : Number(digitsOnly);
        setRowState(prev => {
            const next = [...prev];
            next[i] = {...next[i], startSerial: parsed};
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
            next[i] = {...next[i], loading: true};
            return next;
        });

        try {
            await onFetchSionInputs({normClass, startSerial: sr, rowIndex: i});
        } finally {
            setRowState(prev => {
                const next = [...prev];
                next[i] = {...next[i], loading: false};
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
                            <td><Form.Control value={item.net_quantity ?? ''}
                                              onChange={e => handleFieldChange(i, 'net_quantity', e.target.value)}/>
                            </td>
                            <td><Form.Control value={item.unit ?? ''}
                                              onChange={e => handleFieldChange(i, 'unit', e.target.value)}/></td>
                            <td><Form.Control value={item.currency ?? ''}
                                              onChange={e => handleFieldChange(i, 'currency', e.target.value)}/></td>
                            <td><Form.Control value={item.cif_fc ?? ''}
                                              onChange={e => handleFieldChange(i, 'cif_fc', e.target.value)}/></td>
                            <td><Form.Control value={item.cif_inr ?? ''}
                                              onChange={e => handleFieldChange(i, 'cif_inr', e.target.value)}/></td>

                            <td>
                                <div className="d-flex flex-column gap-2">
                                    <AsyncNormSelect value={2}
                                                     onChange={(v) => setForm((f) => ({...f, norm_class: v}))}/>

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
            <Button size="sm" variant="primary" onClick={onAdd}>+ Add Export Item</Button>
        </>
    );
};

ExportLicenseTable.propTypes = {
    exportItems: PropTypes.arrayOf(PropTypes.object),
    onChange: PropTypes.func,
    onAdd: PropTypes.func,
    onFetchSionInputs: PropTypes.func,
};

export default ExportLicenseTable;
