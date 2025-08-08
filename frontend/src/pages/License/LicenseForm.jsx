import React, {useEffect, useState} from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncCompanySelect from '../../components/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncPortSelect';
import AsyncHSCodeSelect from '../../components/AsyncHSCodeSelect';
import AsyncItemSelect from '../../components/AsyncItemSelect';
import AsyncChoiceSelect from '../../components/AsyncChoiceSelect';
import {useLicenseChoices} from '../../hooks/useChoiceLoader';


import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';

const LicenseForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [data, setData] = useState(entry);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const {choices} = useLicenseChoices();
    const handleChange = (field, value) => {
        setData(prev => ({...prev, [field]: value}));
        setErrors(prev => ({...prev, [field]: null}));
    };

    const handleItemChange = (type, index, field, value) => {
        const key = type === 'export' ? 'export_license' : 'import_license';
        const updated = [...(data[key] || [])];
        updated[index][field] = value;
        setData(prev => ({...prev, [key]: updated}));
    };
    const normalizeSelectField = (raw, options) => {
        if (typeof raw === 'string') {
            const match = options.find(opt => opt.value === raw);
            return match || {value: raw, label: raw}; // fallback label
        }
        return raw;
    };
    useEffect(() => {
        if (entry && choices) {
            setData({
                ...entry,
                purchase_status: normalizeSelectField(entry.purchase_status, choices.purchase_status),
                notification_number: normalizeSelectField(entry.notification_number, choices.notification_number),
            });
        }
    }, [entry, choices]);

    const validate = () => {
        const errs = {};
        if (!data.license_number) errs.license_number = 'Required';
        if (!data.license_date) errs.license_date = 'Required';
        if (!data.license_expiry_date) errs.license_expiry_date = 'Required';
        if (!data.exporter) errs.exporter = 'Required';
        if (!data.port) errs.port = 'Required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const buildPayload = () => ({
        ...data,
        purchase_status: data.purchase_status?.value || '',
        notification_number: data.notification_number?.value || '',
        exporter_id: data.exporter?.id,
        port_id: data.port?.id,
        export_license: (data.export_license || []).map(item => ({
            id: item.id || null,
            description: item.description || '',
            net_quantity: item.net_quantity || '',
            unit: item.unit || 'kg',
            currency: item.currency || 'usd',
            cif_fc: item.cif_fc || '',
            cif_inr: item.cif_inr || '',
            norm_class: item.norm_class || '',
        })),
        import_license: (data.import_license || []).map(item => ({
            id: item.id || null,
            serial_number: item.serial_number,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            cif_fc: item.cif_fc,
            cif_inr: item.cif_inr,
            hs_code_id: item.hs_code?.id || null,
            items_ids: (item.items || []).map(i => i.id),
        }))
    });

    const save = async () => {
        if (!validate()) {
            toast.error('Please fix errors');
            return;
        }

        setSaving(true);
        const payload = buildPayload();
        try {
            let response;
            if (isNew) {
                response = await axios.post('/api/licenses/', payload);
                toast.success('License Created');
            } else {
                response = await axios.patch(`/api/licenses/${data.id}/`, payload);
                toast.success('License Updated');
            }
            onSaved?.(response.data.id, response.data); // pass updated entry
        } catch (err) {
            console.error('Save failed', err.response?.data || err);
            toast.error('Failed to save license');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form>
            <Table bordered size="sm" className="mb-4">
                <tbody>
                <tr>
                    <th style={{width: '20%'}}>License Number</th>
                    <th style={{width: '20%'}}>License Date</th>
                    <th style={{width: '20%'}}>Expiry Date</th>
                    <th style={{width: '20%'}}>Exporter</th>
                    <th style={{width: '20%'}}>Port</th>
                </tr>
                <tr>
                    <td>
                        <Form.Control
                            value={data.license_number ?? ''}
                            isInvalid={!!errors.license_number}
                            onChange={(e) => handleChange('license_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.license_number}
                        </Form.Control.Feedback>
                    </td>


                    <td>
                        <Form.Control
                            type="date"
                            value={data.license_date}
                            isInvalid={!!errors.license_date}
                            onChange={(e) => handleChange('license_date', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.license_date}
                        </Form.Control.Feedback>
                    </td>


                    <td>
                        <Form.Control
                            type="date"
                            value={data.license_expiry_date}
                            isInvalid={!!errors.license_expiry_date}
                            onChange={(e) => handleChange('license_expiry_date', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.license_expiry_date}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <AsyncCompanySelect
                            value={data.exporter}
                            onChange={(v) => handleChange('exporter', v)}
                        />
                        {errors.exporter && (
                            <div className="text-danger small">{errors.exporter}</div>
                        )}
                    </td>

                    <td>
                        <AsyncPortSelect
                            value={data.port}
                            onChange={(v) => handleChange('port', v)}
                        />
                        {errors.port && (
                            <div className="text-danger small">{errors.port}</div>
                        )}
                    </td>
                </tr>
                <tr>
                    <th style={{width: '20%'}}>Reg Number</th>
                    <th style={{width: '20%'}}>Reg Date</th>
                    <th style={{width: '20%'}}>File Number</th>
                    <th style={{width: '20%'}}>Scheme Code</th>
                    <th style={{width: '20%'}}>Notification Number</th>
                </tr>
                <tr>
                    <td>
                        <Form.Control
                            value={data.registration_number}
                            isInvalid={!!errors.registration_number}
                            onChange={(e) => handleChange('registration_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.registration_number}
                        </Form.Control.Feedback>
                    </td>


                    <td>
                        <Form.Control
                            type="date"
                            value={data.registration_date}
                            isInvalid={!!errors.registration_date}
                            onChange={(e) => handleChange('registration_date', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.registration_date}
                        </Form.Control.Feedback>
                    </td>


                    <td>
                        <Form.Control
                            value={data.file_number}
                            isInvalid={!!errors.file_number}
                            onChange={(e) => handleChange('file_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.file_number}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <AsyncChoiceSelect
                            choiceKey="scheme_codes"
                            value={data.scheme_code}
                            onChange={(v) => handleChange('scheme_code', v)}
                        />
                    </td>
                    <td>
                        <AsyncChoiceSelect
                            choiceKey="notification_number"
                            value={data.notification_number}
                            onChange={(v) => handleChange('notification_number', v)}
                        />

                    </td>

                </tr>
                <tr>
                    <th style={{width: '20%'}}>Purchase By</th>
                    <th style={{width: '20%'}}>
                        <Form.Check
                            label="Is Registered"
                            type="switch"
                            checked={data.is_registered}
                            onChange={(e) => handleChange('is_registered', e.target.checked)}
                        />
                    </th>
                    <th colSpan={4}>Condition Sheet</th>

                </tr>
                <tr>
                    <td>
                        <AsyncChoiceSelect
                            choiceKey="purchase_status"
                            value={data.purchase_status}
                            onChange={(v) => handleChange('purchase_status', v)}
                        />
                    </td>


                    <th>
                        <Form.Check
                            label="Is AU"
                            type="switch"
                            checked={data.is_au}
                            onChange={(e) => handleChange('is_au', e.target.checked)}
                        />
                    </th>
                    <td colSpan={3}>
                        <Form.Control
                            value={data.file_number}
                            isInvalid={!!errors.file_number}
                            onChange={(e) => handleChange('file_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.file_number}
                        </Form.Control.Feedback>
                    </td>

                </tr>

                </tbody>
            </Table>

            {/* Export Items */}
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
                {(data.export_license || []).map((item, i) => (
                    <tr key={i}>
                        <td><Form.Control value={item.net_quantity || ''}
                                          onChange={e => handleItemChange('export', i, 'net_quantity', e.target.value)}/>
                        </td>
                        <td><Form.Control value={item.unit || ''}
                                          onChange={e => handleItemChange('export', i, 'unit', e.target.value)}/></td>
                        <td><Form.Control value={item.currency || ''}
                                          onChange={e => handleItemChange('export', i, 'currency', e.target.value)}/>
                        </td>
                        <td><Form.Control value={item.cif_fc || ''}
                                          onChange={e => handleItemChange('export', i, 'cif_fc', e.target.value)}/></td>
                        <td><Form.Control value={item.cif_inr || ''}
                                          onChange={e => handleItemChange('export', i, 'cif_inr', e.target.value)}/>
                        </td>
                        <td><Form.Control value={item.norm_class || ''}
                                          onChange={e => handleItemChange('export', i, 'norm_class', e.target.value)}/>
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>
            <Button size="sm" variant="primary" onClick={() => {
                const newRow = {net_quantity: '', unit: 'kg', currency: 'usd', cif_fc: '', cif_inr: '', norm_class: ''};
                setData(prev => ({...prev, export_license: [...(prev.export_license || []), newRow]}));
            }}>+ Add Export Item</Button>

            {/* Import Items */}
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
                {(data.import_license || []).map((item, i) => (
                    <tr key={i}>
                        <td style={{maxWidth: '20px'}}>
                            <Form.Control
                                value={item.serial_number || ''}
                                onChange={e => handleItemChange('import', i, 'serial_number', e.target.value)}
                            />
                        </td>

                        <td style={{minWidth: '100px'}}>
                            <div className="d-flex flex-column">
                                <AsyncHSCodeSelect
                                    value={item.hs_code}
                                    onChange={(v) => handleItemChange('import', i, 'hs_code', v)}
                                />
                            </div>
                        </td>

                        <td style={{minWidth: '120px'}}>
                            <div className="d-flex flex-column">
                                <AsyncItemSelect
                                    value={item.items}
                                    onChange={(v) => handleItemChange('import', i, 'items', v)}
                                    isMulti
                                />
                            </div>
                        </td>

                        <td style={{minWidth: '200px'}}>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={item.description || ''}
                                onChange={e => handleItemChange('import', i, 'description', e.target.value)}
                            />
                        </td>

                        <td style={{minWidth: '120px'}}>
                            <Form.Control
                                as="textarea"
                                rows={1}
                                style={{whiteSpace: 'normal', resize: 'none'}}
                                value={item.quantity || ''}
                                onChange={e => handleItemChange('import', i, 'quantity', e.target.value)}
                            />
                        </td>

                        <td style={{minWidth: '20px'}}>
                            <Form.Control
                                value={item.unit || ''}
                                onChange={e => handleItemChange('import', i, 'unit', e.target.value)}
                            />
                        </td>

                        <td style={{minWidth: '120px'}}>
                            <div className="d-flex flex-column">
                                <Form.Control
                                    value={item.cif_fc || ''}
                                    onChange={e => handleItemChange('import', i, 'cif_fc', e.target.value)}
                                />
                            </div>
                        </td>

                        <td style={{minWidth: '120px'}}>
                            <div className="d-flex flex-column">
                                <Form.Control
                                    value={item.cif_inr || ''}
                                    onChange={e => handleItemChange('import', i, 'cif_inr', e.target.value)}
                                />
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>

            <Button size="sm" variant="primary" onClick={() => {
                const newRow = {
                    serial_number: '',
                    description: '',
                    quantity: '',
                    unit: 'kg',
                    cif_fc: '',
                    cif_inr: '',
                    hs_code: null,
                    items: []
                };
                setData(prev => ({...prev, import_license: [...(prev.import_license || []), newRow]}));
            }}>+ Add Import Item</Button>

            <div className="mt-3">
                <Button variant="success" size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </Button>
                {onClose && <Button variant="secondary" size="sm" className="ms-2" onClick={onClose}>Cancel</Button>}
            </div>
        </Form>
    );
};

export default LicenseForm;