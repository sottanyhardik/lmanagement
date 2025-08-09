import React from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncHSCodeSelect from '../../components/AsyncHSCodeSelect';
import AsyncItemSelect from '../../components/AsyncItemSelect';

const ImportLicenseTable = ({importItems = [], onChange, onAdd}) => {
    const handleItemChange = (index, field, value) => {
        const updated = [...importItems];
        updated[index] = {...updated[index], [field]: value};
        onChange?.(updated);
    };

    return (
        <>
            <h6 className="mt-4">Import Items</h6>
            <Table size="sm" bordered responsive>
                <thead className="table-light">
                <tr>
                    <th>Serial No</th>
                    <th>HS Code</th>
                    <th>Items</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>CIF FC</th>
                    <th>CIF INR</th>
                </tr>
                </thead>
                <tbody>
                {importItems.map((item, i) => (
                    <tr key={i}>
                        <td>
                            <Form.Control
                                value={item.serial_number ?? ''}
                                onChange={e => handleItemChange(i, 'serial_number', e.target.value)}
                            />
                        </td>
                        <td style={{minWidth: 100}}>
                            <AsyncHSCodeSelect
                                value={item.hs_code ?? null}
                                onChange={v => handleItemChange(i, 'hs_code', v)}
                            />
                        </td>
                        <td style={{minWidth: 120}}>
                            <AsyncItemSelect
                                value={item.items ?? []}
                                onChange={v => handleItemChange(i, 'items', v)}
                                isMulti
                            />
                        </td>
                        <td style={{minWidth: 200}}>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={item.description ?? ''}
                                onChange={e => handleItemChange(i, 'description', e.target.value)}
                            />
                        </td>
                        <td style={{minWidth: 120}}>
                            <Form.Control
                                value={item.quantity ?? ''}
                                onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={item.unit ?? ''}
                                onChange={e => handleItemChange(i, 'unit', e.target.value)}
                            />
                        </td>
                        <td style={{minWidth: 120}}>
                            <Form.Control
                                value={item.cif_fc ?? ''}
                                onChange={e => handleItemChange(i, 'cif_fc', e.target.value)}
                            />
                        </td>
                        <td style={{minWidth: 120}}>
                            <Form.Control
                                value={item.cif_inr ?? ''}
                                onChange={e => handleItemChange(i, 'cif_inr', e.target.value)}
                            />
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>

            <Button size="sm" variant="primary" onClick={onAdd}>
                + Add Import Item
            </Button>
        </>
    );
};

export default ImportLicenseTable;
