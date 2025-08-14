// LicenseForm.jsx
import React, {useEffect, useState} from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect';
import AsyncChoiceSelect from '../../components/AsyncSelect/AsyncChoiceSelect';
import {useLicenseChoices} from '../../hooks/useChoiceLoader';
import ExportLicenseTable from './ExportLicenseTable';
import ImportLicenseTable from './ImportLicenseTable';

import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';

const LicenseForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [data, setData] = useState(entry || {});
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

    const normalizeSelectField = (raw, options = []) => {
        if (raw == null) return null;
        if (typeof raw === 'string' || typeof raw === 'number') {
            const match = options.find(opt => opt.value === raw);
            return match || {value: raw, label: String(raw)};
        }
        return raw;
    };

    // helper to blank Export norm on prefill (requested)
    const blankExportNorms = (exportList = []) =>
        exportList.map(item => ({...item, norm_class: null}));

    useEffect(() => {
        if (entry && choices) {
            setData({
                ...entry,
                purchase_status: normalizeSelectField(entry.purchase_status, choices.purchase_status),
                notification_number: normalizeSelectField(entry.notification_number, choices.notification_number),
                // force Export norm_class blank on prefill
                export_license: blankExportNorms(entry.export_license || []),
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
            norm_class_id: item.norm_class?.id ?? item.norm_class?.value ?? null,
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
        })),
    });

    // ---- SION fetch/prefill support ----
    const getNormId = normClass => {
        if (normClass == null) return null;
        if (typeof normClass === 'number' || typeof normClass === 'string') return normClass;
        return normClass.id ?? normClass.value ?? null;
    };

    /**
     * Fetch SION inputs for a selected norm and prefill ONLY import item descriptions
     * starting at the provided serial number.
     * Expects backend: GET /api/sion-classes/:id/ -> { import_norm: [{ sr_no, description, ... }, ...] }
     */
    const handleFetchSionInputs = async ({normClass, startSerial /*, rowIndex */}) => {
        const normId = getNormId(normClass);
        if (!normId) {
            toast.warn('Please select a SION Norm first.');
            return;
        }

        try {
            const {data: sion} = await axios.get(`sion-classes/${normId}/`);
            const importNorms = Array.isArray(sion?.import_norm) ? sion.import_norm : [];
            if (importNorms.length === 0) {
                toast.info('No SION import norms found for the selected class.');
                return;
            }

            setData(prev => {
                const existing = [...(prev.import_license || [])];
                const startIdx = Math.max(0, Number(startSerial || 1) - 1);

                const requiredLength = startIdx + importNorms.length;
                while (existing.length < requiredLength) {
                    existing.push({
                        serial_number: existing.length + 1,
                        description: '',
                        quantity: '',
                        unit: 'kg',
                        cif_fc: '',
                        cif_inr: '',
                        hs_code: null,
                        items: [],
                    });
                }

                // Prefill ONLY description
                importNorms.forEach((n, i) => {
                    const row = existing[startIdx + i];
                    if (!row.description || row.description.trim() === '') {
                        row.description = n?.description ?? row.description;
                    }
                });

                // Re-sequence serial numbers
                existing.forEach((r, i) => (r.serial_number = i + 1));

                return {...prev, import_license: existing};
            });

            toast.success('Descriptions prefilled from SION norms.');
        } catch (err) {
            console.error('SION fetch error', err);
            toast.error('Failed to fetch SION norms.');
        }
    };
    // ---- end SION support ----

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
                response = await axios.post('licenses/', payload);
                toast.success('License Created');
            } else {
                response = await axios.patch(`licenses/${data.id}/`, payload);
                toast.success('License Updated');
            }
            onSaved?.(response.data.id, response.data);
        } catch (err) {
            console.error('Save failed', err?.response?.data || err);
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
                            onChange={e => handleChange('license_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.license_number}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <Form.Control
                            type="date"
                            value={data.license_date || ''}
                            isInvalid={!!errors.license_date}
                            onChange={e => handleChange('license_date', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.license_date}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <Form.Control
                            type="date"
                            value={data.license_expiry_date || ''}
                            isInvalid={!!errors.license_expiry_date}
                            onChange={e => handleChange('license_expiry_date', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.license_expiry_date}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <AsyncCompanySelect value={data.exporter} onChange={v => handleChange('exporter', v)}/>
                        {errors.exporter && <div className="text-danger small">{errors.exporter}</div>}
                    </td>
                    <td>
                        <AsyncPortSelect value={data.port} onChange={v => handleChange('port', v)}/>
                        {errors.port && <div className="text-danger small">{errors.port}</div>}
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
                            value={data.registration_number || ''}
                            isInvalid={!!errors.registration_number}
                            onChange={e => handleChange('registration_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.registration_number}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <Form.Control
                            type="date"
                            value={data.registration_date || ''}
                            isInvalid={!!errors.registration_date}
                            onChange={e => handleChange('registration_date', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.registration_date}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <Form.Control
                            value={data.file_number || ''}
                            isInvalid={!!errors.file_number}
                            onChange={e => handleChange('file_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.file_number}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <AsyncChoiceSelect
                            choiceKey="scheme_codes"
                            value={data.scheme_code}
                            onChange={v => handleChange('scheme_code', v)}
                        />
                    </td>
                    <td>
                        <AsyncChoiceSelect
                            choiceKey="notification_number"
                            value={data.notification_number}
                            onChange={v => handleChange('notification_number', v)}
                        />
                    </td>
                </tr>

                <tr>
                    <th style={{width: '20%'}}>Purchase By</th>
                    <th style={{width: '20%'}}>
                        <Form.Check
                            label="Is Registered"
                            type="switch"
                            checked={!!data.is_registered}
                            onChange={e => handleChange('is_registered', e.target.checked)}
                        />
                    </th>
                    <th colSpan={4}>Condition Sheet</th>
                </tr>
                <tr>
                    <td>
                        <AsyncChoiceSelect
                            choiceKey="purchase_status"
                            value={data.purchase_status}
                            onChange={v => handleChange('purchase_status', v)}
                        />
                    </td>
                    <th>
                        <Form.Check
                            label="Is AU"
                            type="switch"
                            checked={!!data.is_au}
                            onChange={e => handleChange('is_au', e.target.checked)}
                        />
                    </th>
                    <td colSpan={3}>
                        <Form.Control
                            value={data.file_number || ''}
                            isInvalid={!!errors.file_number}
                            onChange={e => handleChange('file_number', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.file_number}
                        </Form.Control.Feedback>
                    </td>
                </tr>
                </tbody>
            </Table>

            <ExportLicenseTable
                exportItems={data.export_license || []}
                onChange={updated => setData(prev => ({...prev, export_license: updated}))}
                onAdd={() =>
                    setData(prev => ({
                        ...prev,
                        export_license: [
                            ...(prev.export_license || []),
                            {net_quantity: '', unit: 'kg', currency: 'usd', cif_fc: '', cif_inr: '', norm_class: null},
                        ],
                    }))
                }
                onFetchSionInputs={handleFetchSionInputs}
            />

            <ImportLicenseTable
                importItems={data.import_license || []}
                onChange={updated => setData(prev => ({...prev, import_license: updated}))}
                onAdd={() =>
                    setData(prev => ({
                        ...prev,
                        import_license: [
                            ...(prev.import_license || []),
                            {
                                serial_number: '',
                                description: '',
                                quantity: '',
                                unit: 'kg',
                                cif_fc: '',
                                cif_inr: '',
                                hs_code: null,
                                items: [],
                            },
                        ],
                    }))
                }
            />

            <div className="mt-3">
                <Button variant="success" size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </Button>
                {onClose && (
                    <Button variant="secondary" size="sm" className="ms-2" onClick={onClose}>
                        Cancel
                    </Button>
                )}
            </div>
        </Form>
    );
};

export default LicenseForm;
