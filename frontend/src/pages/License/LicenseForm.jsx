// src/pages/License/LicenseForm.jsx
import React, {useEffect, useState} from 'react';
import {Button, Form, Table} from 'react-bootstrap';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect';
import {useLicenseChoices} from '../../hooks/useChoiceLoader';
import ExportLicenseTable from './ExportLicenseTable';
import ImportLicenseTable from './ImportLicenseTable';
import ChoiceSelect from '../../components/AsyncSelect/ChoiceSelect.jsx';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';

const DEFAULT_NOTIFICATION = '025/2023';
const DEFAULT_SCHEME = '26';
const DEFAULT_PURCHASE = 'GE';

/* ---------------- helpers ---------------- */
const addOneYear = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return '';
    const dt = new Date(y + 1, m - 1, d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const stripFirstLeadingZero = (s) => {
    const str = s == null ? '' : String(s);
    return str.startsWith('0') ? str.slice(1) : str;
};

// extract PK from option/object/primitive
const getPk = (v) => {
    if (v == null) return null;
    if (typeof v === 'number' || typeof v === 'string') return v;
    return v.value ?? v.id ?? v?.data?.id ?? null;
};

// Normalize SION option for UI
const normalizeNormOption = (nc) => {
    if (!nc) return null;
    const id = nc.id ?? nc.value ?? null;
    const value = nc.value ?? id;
    const label = nc.label ?? nc.norm_class ?? nc.name ?? String(id ?? '');
    return {id, value, label};
};

// Prefer id/value from normClass (number|string|option obj)
const getNormId = (normClass) => {
    if (normClass == null) return null;
    if (typeof normClass === 'number' || typeof normClass === 'string') return normClass;
    return normClass.id ?? normClass.value ?? null;
};

const LicenseForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [data, setData] = useState(entry || {});
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const {choices} = useLicenseChoices();

    const handleChange = (field, value) => {
        setData((prev) => ({...prev, [field]: value}));
        setErrors((prev) => ({...prev, [field]: null}));
    };

    // Normalize entry & export rows for UI
    useEffect(() => {
        if (!entry) return;

        const normalizedExport = (entry.export_license || []).map((row) => {
            const norm = normalizeNormOption(row?.norm_class);
            return {
                ...row,
                norm_class: norm,
                norm_class_id: norm?.id ?? null,
            };
        });

        setData({
            ...entry,
            export_license: normalizedExport,
            // keep condition_sheet separate from file_number (text area)
            condition_sheet: entry.condition_sheet ?? entry.condition ?? '',
        });
    }, [entry]);

    // Apply defaults for NEW records once
    useEffect(() => {
        if (!isNew) return;
        setData((prev) => ({
            ...prev,
            notification_number: prev.notification_number || DEFAULT_NOTIFICATION,
            scheme_code: prev.scheme_code || DEFAULT_SCHEME,
            purchase_status: prev.purchase_status || DEFAULT_PURCHASE,
        }));
    }, [isNew]);

    // License Number -> Registration Number (remove only first leading zero)
    const handleLicenseNumberChange = (e) => {
        const v = e.target.value;
        const reg = stripFirstLeadingZero(v);
        setData((prev) => ({
            ...prev,
            license_number: v,
            registration_number: reg,
        }));
        setErrors((prev) => ({...prev, license_number: null, registration_number: null}));
    };

    // License Date -> Registration Date & Expiry (+1 year)
    const handleLicenseDateChange = (e) => {
        const v = e.target.value; // yyyy-mm-dd
        setData((prev) => ({
            ...prev,
            license_date: v,
            registration_date: v,
            license_expiry_date: addOneYear(v),
        }));
        setErrors((prev) => ({
            ...prev,
            license_date: null,
            registration_date: null,
            license_expiry_date: null,
        }));
    };

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

    // ---------- payload builder (omit id when falsy) ----------
    const buildPayload = () => ({
        ...data,
        exporter_id: data.exporter?.id,
        port_id: data.port?.id,

        notification_number:
            data.notification_number || (isNew ? DEFAULT_NOTIFICATION : data.notification_number),
        scheme_code: data.scheme_code || (isNew ? DEFAULT_SCHEME : data.scheme_code),
        purchase_status: data.purchase_status || (isNew ? DEFAULT_PURCHASE : data.purchase_status),

        // text field separate from file_number
        condition_sheet: data.condition_sheet ?? '',

        export_license: (data.export_license || []).map((item) => {
            const row = {
                description: item.description || '',
                net_quantity: item.net_quantity || '0',
                unit: item.unit || 'kg',
                currency: item.currency || 'usd',
                cif_fc: item.cif_fc || '0',
                cif_inr: item.cif_inr || '0',
                fob_inr: item.fob_inr || '0',
                norm_class_id:
                    item.norm_class_id ??
                    getNormId(item.norm_class) ??
                    null,
            };
            if (item.id) row.id = item.id; // only include id when truthy
            return row;
        }),

        import_license: (data.import_license || []).map((item) => {
            const row = {
                serial_number: item.serial_number,
                description: item.description,
                quantity: item.quantity || '0',
                unit: item.unit,
                cif_fc: item.cif_fc || '0',
                cif_inr: item.cif_inr || '0',
                hs_code_id:
                    item.hs_code_id ??
                    getPk(item.hs_code) ??
                    null,
                items_ids: (item.items || []).map((i) => i.id),
            };
            if (item.id) row.id = item.id; // only include id when truthy
            return row;
        }),
    });

    // ---- SION fetch/prefill support ----
    const handleFetchSionInputs = async ({normClass, startSerial}) => {
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

            setData((prev) => {
                const existing = [...(prev.import_license || [])];
                const startIdx = Math.max(0, Number(startSerial || 1) - 1);

                // Ensure we have enough rows to fill into
                const requiredLength = startIdx + importNorms.length;
                while (existing.length < requiredLength) {
                    existing.push({
                        serial_number: existing.length + 1,
                        description: '',
                        quantity: '0',
                        unit: 'kg',
                        cif_fc: '0',
                        cif_inr: '0',
                        hs_code: null,
                        hs_code_id: null,
                        items: [],
                    });
                }

                // Prefill description + HS code if blank
                importNorms.forEach((n, i) => {
                    const row = existing[startIdx + i];

                    if (!row.description || row.description.trim() === '') {
                        row.description = n?.description ?? row.description;
                    }

                    // auto-fill HS only when empty; also set hs_code_id (PK)
                    if (!row.hs_code && n?.hsn_code?.id) {
                        row.hs_code = {
                            value: n.hsn_code.id,
                            label: n.hsn_code.hs_code, // e.g. "2009"
                            data: n.hsn_code,
                        };
                        row.hs_code_id = n.hsn_code.id;
                    }
                });

                // Resequence serial numbers
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
            const apiErrors = err?.response?.data || {};
            setErrors(apiErrors);
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
                            onChange={handleLicenseNumberChange}
                            disabled={saving}
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
                            onChange={handleLicenseDateChange}
                            disabled={saving}
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
                            onChange={(e) => handleChange('license_expiry_date', e.target.value)}
                            disabled={saving}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.license_expiry_date}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <AsyncCompanySelect
                            value={data.exporter}
                            onChange={(v) => handleChange('exporter', v)}
                            isDisabled={saving}
                        />
                        {errors.exporter && (
                            <div className="text-danger small">{errors.exporter}</div>
                        )}
                    </td>
                    <td>
                        <AsyncPortSelect
                            value={data.port}
                            onChange={(v) => handleChange('port', v)}
                            isDisabled={saving}
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
                            value={data.registration_number || ''}
                            isInvalid={!!errors.registration_number}
                            onChange={(e) => handleChange('registration_number', e.target.value)}
                            disabled={saving}
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
                            onChange={(e) => handleChange('registration_date', e.target.value)}
                            disabled={saving}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.registration_date}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <Form.Control
                            value={data.file_number || ''}
                            isInvalid={!!errors.file_number}
                            onChange={(e) => handleChange('file_number', e.target.value)}
                            disabled={saving}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.file_number}
                        </Form.Control.Feedback>
                    </td>
                    <td>
                        <ChoiceSelect
                            choiceKey="scheme_codes"
                            value={data.scheme_code || (isNew ? DEFAULT_SCHEME : '')}
                            onChange={(v) => setData((prev) => ({...prev, scheme_code: v}))}
                            returnValues
                            isDisabled={saving}
                        />
                    </td>
                    <td>
                        <ChoiceSelect
                            choiceKey="notification_number"
                            value={data.notification_number || (isNew ? DEFAULT_NOTIFICATION : '')}
                            onChange={(v) =>
                                setData((prev) => ({...prev, notification_number: v}))
                            }
                            returnValues
                            isDisabled={saving}
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
                            onChange={(e) => handleChange('is_registered', e.target.checked)}
                            disabled={saving}
                        />
                    </th>
                    <th colSpan={4}>Condition Sheet</th>
                </tr>
                <tr>
                    <td>
                        <ChoiceSelect
                            choiceKey="purchase_status"
                            value={data.purchase_status || (isNew ? DEFAULT_PURCHASE : '')}
                            onChange={(v) => setData((prev) => ({...prev, purchase_status: v}))}
                            returnValues
                            isDisabled={saving}
                        />
                    </td>
                    <th>
                        <Form.Check
                            label="Is AU"
                            type="switch"
                            checked={!!data.is_au}
                            onChange={(e) => handleChange('is_au', e.target.checked)}
                            disabled={saving}
                        />
                    </th>
                    <td colSpan={3}>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder="Enter condition sheet details (optional)"
                            value={data.condition_sheet || ''}
                            isInvalid={!!errors.condition_sheet}
                            onChange={(e) => handleChange('condition_sheet', e.target.value)}
                            disabled={saving}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.condition_sheet}
                        </Form.Control.Feedback>
                    </td>
                </tr>
                </tbody>
            </Table>

            <ExportLicenseTable
                exportItems={data.export_license || []}
                onChange={(updated) => setData((prev) => ({...prev, export_license: updated}))}
                onAdd={() =>
                    setData((prev) => ({
                        ...prev,
                        export_license: [
                            ...(prev.export_license || []),
                            {
                                net_quantity: '0',
                                unit: 'kg',
                                currency: 'usd',
                                cif_fc: '0',
                                cif_inr: '0',
                                fob_inr: '0',
                                norm_class: null,
                                norm_class_id: null,
                            },
                        ],
                    }))
                }
                onFetchSionInputs={handleFetchSionInputs}
                errors={errors}
                disabled={saving}
            />

            <ImportLicenseTable
                importItems={data.import_license || []}
                onChange={(updated) => setData((prev) => ({...prev, import_license: updated}))}
                onAdd={() =>
                    setData((prev) => ({
                        ...prev,
                        import_license: [
                            ...(prev.import_license || []),
                            {
                                serial_number: '',
                                description: '',
                                quantity: '0',
                                unit: 'kg',
                                cif_fc: '0',
                                cif_inr: '0',
                                hs_code: null,
                                hs_code_id: null, // keep pk alongside the select value
                                items: [],
                            },
                        ],
                    }))
                }
                errors={errors}
                disabled={saving}
            />

            <div className="mt-3">
                <Button variant="success" size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </Button>
                {onClose && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="ms-2"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                )}
            </div>
        </Form>
    );
};

export default LicenseForm;
