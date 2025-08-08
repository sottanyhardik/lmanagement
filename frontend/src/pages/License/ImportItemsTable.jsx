import React from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncHSCodeSelect from '../../components/AsyncHSCodeSelect';
import AsyncItemSelect from '../../components/AsyncItemSelect';

const ImportItemsTable = ({data = [], onChange, setData}) => {
    const handleChange = (index, field, value) => {
        onChange('import', index, field, value);
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
                {data.map((item, i) => (
                    <tr key={i}>
                        <td><Form.Control value={item.serial_number ?? ''}
                                          onChange={e => handleChange(i, 'serial_number', e.target.value)}/></td>
                        <td><AsyncHSCodeSelect value={item.hs_code} onChange={v => handleChange(i, 'hs_code', v)}/></td>
                        <td><AsyncItemSelect value={item.items} onChange={v => handleChange(i, 'items', v)} isMulti/>
                        </td>
                        <td><Form.Control as="textarea" rows={1} value={item.description ?? ''}
                                          onChange={e => handleChange(i, 'description', e.target.value)}/></td>
                        <td><Form.Control type="number" value={item.quantity ?? ''}
                                          onChange={e => handleChange(i, 'quantity', e.target.value)}/></td>
                        <td><Form.Control value={item.unit ?? ''}
                                          onChange={e => handleChange(i, 'unit', e.target.value)}/></td>
                        <td><Form.Control type="number" value={item.cif_fc ?? ''}
                                          onChange={e => handleChange(i, 'cif_fc', e.target.value)}/></td>
                        <td><Form.Control type="number" value={item.cif_inr ?? ''}
                                          onChange={e => handleChange(i, 'cif_inr', e.target.value)}/></td>
                    </tr>
                ))}
                </tbody>
            </Table>
            <Button size="sm" variant="primary" onClick={() => {
                const newRow = {
                    serial_number: '',
                    hs_code: null,
                    items: [],
                    description: '',
                    quantity: '',
                    unit: 'kg',
                    cif_fc: '',
                    cif_inr: ''
                };
                setData(prev => ({...prev, import_license: [...(prev.import_license || []), newRow]}));
            }}>+ Add Import Item</Button>
        </>
    );
};

export default ImportItemsTable;
