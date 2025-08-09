import React from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncNormSelect from '../../components/AsyncNormSelect';

const ExportLicenseTable = ({exportItems = [], onChange, onAdd}) => {
    const handleItemChange = (index, field, value) => {
        const updated = [...exportItems];
        updated[index] = {...updated[index], [field]: value};
        onChange?.(updated);
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
                    <th>Norm Class</th>
                </tr>
                </thead>
                <tbody>
                {exportItems.map((item, i) => (
                    <tr key={i}>
                        <td>
                            <Form.Control
                                value={item.net_quantity ?? ''}
                                onChange={e => handleItemChange(i, 'net_quantity', e.target.value)}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={item.unit ?? ''}
                                onChange={e => handleItemChange(i, 'unit', e.target.value)}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={item.currency ?? ''}
                                onChange={e => handleItemChange(i, 'currency', e.target.value)}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={item.cif_fc ?? ''}
                                onChange={e => handleItemChange(i, 'cif_fc', e.target.value)}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={item.cif_inr ?? ''}
                                onChange={e => handleItemChange(i, 'cif_inr', e.target.value)}
                            />
                        </td>
                        <td>
                            <AsyncNormSelect
                                value={item.norm_class ?? null}
                                onChange={v => handleItemChange(i, 'norm_class', v)}
                            />
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>

            <Button size="sm" variant="primary" onClick={onAdd}>
                + Add Export Item
            </Button>
        </>
    );
};

export default ExportLicenseTable;
