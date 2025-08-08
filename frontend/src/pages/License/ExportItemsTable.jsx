import React from 'react';
import {Button, Form, Table} from 'react-bootstrap';

const ExportItemsTable = ({data = [], onChange, setData}) => {
    const handleChange = (index, field, value) => {
        onChange('export', index, field, value);
    };

    return (
        <>
            <h6 className="mt-4">Export Items</h6>
            <Table size="sm" bordered responsive>
                <thead className="table-light">
                <tr>
                    <th>Description</th>
                    <th>Net Qty</th>
                    <th>Unit</th>
                    <th>Currency</th>
                    <th>CIF FC</th>
                    <th>CIF INR</th>
                    <th>Norm Class</th>
                </tr>
                </thead>
                <tbody>
                {data.map((item, i) => (
                    <tr key={i}>
                        <td><Form.Control value={item.description ?? ''}
                                          onChange={e => handleChange(i, 'description', e.target.value)}/></td>
                        <td><Form.Control type="number" value={item.net_quantity ?? ''}
                                          onChange={e => handleChange(i, 'net_quantity', e.target.value)}/></td>
                        <td><Form.Control value={item.unit ?? ''}
                                          onChange={e => handleChange(i, 'unit', e.target.value)}/></td>
                        <td><Form.Control value={item.currency ?? ''}
                                          onChange={e => handleChange(i, 'currency', e.target.value)}/></td>
                        <td><Form.Control type="number" value={item.cif_fc ?? ''}
                                          onChange={e => handleChange(i, 'cif_fc', e.target.value)}/></td>
                        <td><Form.Control type="number" value={item.cif_inr ?? ''}
                                          onChange={e => handleChange(i, 'cif_inr', e.target.value)}/></td>
                        <td><Form.Control value={item.norm_class ?? ''}
                                          onChange={e => handleChange(i, 'norm_class', e.target.value)}/></td>
                    </tr>
                ))}
                </tbody>
            </Table>
            <Button size="sm" variant="primary" onClick={() => {
                const newRow = {
                    description: '',
                    net_quantity: '',
                    unit: 'kg',
                    currency: 'usd',
                    cif_fc: '',
                    cif_inr: '',
                    norm_class: ''
                };
                setData(prev => ({...prev, export_license: [...(prev.export_license || []), newRow]}));
            }}>+ Add Export Item</Button>
        </>
    );
};

export default ExportItemsTable;
