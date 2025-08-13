// src/components/GenericForm.jsx
import React, {useEffect, useMemo, useState} from 'react';
import {toast} from 'react-toastify';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';
import Modal from 'react-modal';
import axios from '../api/axiosInstance';
import './GenericForm.css';
import './ModalFix.css';

/* ---------------- UI helpers ---------------- */

const defaultNoOptions = (onAdd) => () => (
    <span>
    No options.{' '}
        {onAdd && (
            <button type="button" className="btn btn-link p-0" onClick={onAdd}>
                Add new
            </button>
        )}
  </span>
);

function reactSelectValueFromPrimitive(opts, value) {
    if (!opts?.length) return null;
    return opts.find((o) => o.value === value) || null;
}

/* ---------------- data helpers ---------------- */

function pickLabel(obj) {
    return (
        obj?.name ||
        obj?.hs_code ||
        obj?.label ||
        obj?.display_name ||
        String(obj?.id ?? '—')
    );
}

/** Inflate server values into react-select shapes for UI */
function normalizeForUI(data, fields) {
    if (!data) return {};
    const out = {...data};

    const inflateValue = (v) =>
        v && typeof v === 'object' ? {value: v.id, label: pickLabel(v)} : v;

    const inflateArray = (arr) =>
        Array.isArray(arr)
            ? arr.map((it) =>
                typeof it === 'object'
                    ? {
                        value: it.id,
                        label: `${it.hs_code ?? pickLabel(it)}${
                            it.product_description ? ` - ${it.product_description}` : ''
                        }`,
                    }
                    : it
            )
            : [];

    for (const field of fields) {
        const val = out[field.name];

        // simple (non-repeatable, no group)
        if (!field.repeatable && !field.group) {
            if (field.type === 'async-select') out[field.name] = inflateValue(val);
            if (field.type === 'multi-async-select') out[field.name] = inflateArray(val);
            continue;
        }

        // grouped (object with subfields)
        if (!field.repeatable && field.group && typeof out[field.group] === 'object') {
            const groupObj = {...(out[field.group] || {})};
            for (const sub of field.fields || []) {
                const subVal = groupObj[sub.name];
                if (sub.type === 'async-select') groupObj[sub.name] = inflateValue(subVal);
                if (sub.type === 'multi-async-select') groupObj[sub.name] = inflateArray(subVal);
            }
            out[field.group] = groupObj;
            continue;
        }

        // repeatable (formset)
        if (field.repeatable && Array.isArray(out[field.group])) {
            out[field.group] = out[field.group].map((row) => {
                const r = {...row};
                for (const sub of field.fields || []) {
                    const subVal = r[sub.name];
                    if (sub.type === 'async-select') r[sub.name] = inflateValue(subVal);
                    if (sub.type === 'multi-async-select') r[sub.name] = inflateArray(subVal);
                }
                return r;
            });
        }
    }

    return out;
}

function serializeFieldValue(fieldDef, val) {
    if (fieldDef.type === 'async-select') {
        return val && typeof val === 'object' ? val.value : val ?? null;
    }
    if (fieldDef.type === 'multi-async-select') {
        return Array.isArray(val)
            ? val
                .map((v) => (typeof v === 'object' ? v.value : v))
                .filter((v) => v != null)
            : [];
    }
    if (fieldDef.type === 'checkbox') {
        return !!val;
    }
    return val ?? null;
}

function serializeGroupRows(rows = [], subFields = []) {
    return rows.map((row) =>
        (subFields || []).reduce((acc, sub) => {
            acc[sub.name] = serializeFieldValue(sub, row?.[sub.name]);
            return acc;
        }, {})
    );
}

/** Build payload (JSON or multipart) from UI state */
function buildPayload(form, fields) {
    const hasFile = fields.some((f) => f.type === 'file');

    if (!hasFile) {
        const json = {};
        for (const field of fields) {
            // repeatable formset: array of objects
            if (field.repeatable && field.group) {
                const rows = Array.isArray(form[field.group]) ? form[field.group] : [];
                json[field.group] = serializeGroupRows(rows, field.fields);
                continue;
            }
            // non-repeatable group object
            if (!field.repeatable && field.group && Array.isArray(field.fields)) {
                const g = form[field.group] || {};
                json[field.group] = field.fields.reduce((acc, sub) => {
                    acc[sub.name] = serializeFieldValue(sub, g?.[sub.name]);
                    return acc;
                }, {});
                continue;
            }
            // simple field
            const raw = field.group ? form[field.group]?.[field.name] : form[field.name];
            json[field.name] = serializeFieldValue(field, raw);
        }
        return {data: json, isMultipart: false};
    }

    const fd = new FormData();
    for (const field of fields) {
        if (field.repeatable && field.group) {
            const rows = Array.isArray(form[field.group]) ? form[field.group] : [];
            fd.append(field.group, JSON.stringify(serializeGroupRows(rows, field.fields)));
            continue;
        }
        if (!field.repeatable && field.group && Array.isArray(field.fields)) {
            const g = form[field.group] || {};
            const groupObj = field.fields.reduce((acc, sub) => {
                acc[sub.name] = serializeFieldValue(sub, g?.[sub.name]);
                return acc;
            }, {});
            fd.append(field.group, JSON.stringify(groupObj));
            continue;
        }

        const raw = field.group ? form[field.group]?.[field.name] : form[field.name];

        if (field.type === 'file') {
            if (raw != null) fd.append(field.name, raw);
            continue;
        }

        const v = serializeFieldValue(field, raw);
        if (
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean' ||
            v == null
        ) {
            fd.append(field.name, v ?? '');
        } else {
            fd.append(field.name, JSON.stringify(v));
        }
    }
    return {data: fd, isMultipart: true};
}

/* ---------------- Component ---------------- */

const GenericForm = ({
                         apiEndpoint,          // e.g., 'licenses/123/' (axios baseURL handles '/api/')
                         fields,
                         token,                // optional, axios interceptor usually handles auth
                         title = 'Update',
                         method = 'PUT',
                         fetchOnLoad = true,
                         initialData = {},
                         onSuccess,
                         onError,
                     }) => {
    const [form, setForm] = useState(initialData);
    const [editMode, setEditMode] = useState(method === 'POST');
    const [loading, setLoading] = useState(fetchOnLoad && method !== 'POST');
    const [errors, setErrors] = useState({});
    const [previews, setPreviews] = useState({});
    const [modalState, setModalState] = useState({
        isOpen: false,
        field: null,
        groupIndex: null,
    });
    const [newOptionValue, setNewOptionValue] = useState('');

    // optional auth override when token prop is provided
    const authHeaders = useMemo(
        () => (token ? {Authorization: `Bearer ${token}`} : undefined),
        [token]
    );

    // Load existing record
    useEffect(() => {
        if (!fetchOnLoad || method === 'POST') {
            setLoading(false);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const {data} = await axios.get(apiEndpoint, {headers: authHeaders});
                if (cancelled) return;
                setForm(normalizeForUI(data, fields));
            } catch {
                toast.error('Failed to load data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiEndpoint, fetchOnLoad, method, JSON.stringify(fields)]);

    const handleChange = (e, group = null, index = null, subfield = null) => {
        const {name, type, checked, files, value} = e.target;
        let fieldValue = value;

        if (type === 'checkbox') fieldValue = checked;

        if (type === 'file') {
            const file = files?.[0] ?? null;
            fieldValue = file;
            if (file?.type?.startsWith?.('image/')) {
                const reader = new FileReader();
                reader.onloadend = () =>
                    setPreviews((prev) => ({...prev, [name]: reader.result}));
                reader.readAsDataURL(file);
            } else {
                setPreviews((prev) => ({...prev, [name]: null}));
            }
        }

        setErrors((prev) => ({...prev, [name]: ''}));

        if (group && index != null && subfield) {
            setForm((prev) => {
                const list = Array.isArray(prev[group]) ? [...prev[group]] : [];
                list[index] = {...(list[index] || {}), [subfield]: fieldValue};
                return {...prev, [group]: list};
            });
        } else if (group) {
            setForm((prev) => ({
                ...prev,
                [group]: {...(prev[group] || {}), [name]: fieldValue},
            }));
        } else {
            setForm((prev) => ({...prev, [name]: fieldValue}));
        }
    };

    const validate = () => {
        const newErrors = {};
        for (const field of fields) {
            if (field.repeatable) {
                const list = form[field.group] || [];
                list.forEach((row, idx) => {
                    for (const sub of field.fields || []) {
                        const v = row?.[sub.name];
                        if (sub.required && (v == null || v === '' || (Array.isArray(v) && v.length === 0))) {
                            newErrors[`${field.group}.${idx}.${sub.name}`] = `${sub.label} is required`;
                        }
                    }
                });
                continue;
            }
            const v = field.group ? form[field.group]?.[field.name] : form[field.name];
            if (field.required && (v == null || v === '' || (Array.isArray(v) && v.length === 0))) {
                newErrors[field.name] = `${field.label} is required`;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            const {data, isMultipart} = buildPayload(form, fields);
            const res = await axios.request({
                url: apiEndpoint,
                method,
                data,
                headers: {
                    ...(authHeaders || {}),
                    ...(isMultipart ? {} : {'Content-Type': 'application/json'}),
                },
            });

            toast.success(`${title} successful`);
            if (method !== 'POST') setEditMode(false);
            onSuccess?.(res.data);
        } catch (err) {
            const detail = err?.response?.data;
            if (detail && typeof detail === 'object') {
                const apiErrors = Object.entries(detail).reduce((acc, [key, val]) => {
                    acc[key] = Array.isArray(val) ? val.join(', ') : String(val);
                    return acc;
                }, {});
                setErrors(apiErrors);
                toast.error(`${title} failed: Check form fields`);
            } else {
                toast.error(`${title} failed`);
            }
            onError?.(err);
        }
    };

    const handleCreateNewOption = async () => {
        const {field, groupIndex} = modalState;
        if (!field?.createEndpoint || !newOptionValue.trim()) return;
        try {
            const {data} = await axios.post(
                field.createEndpoint,
                {name: newOptionValue.trim()},
                {headers: authHeaders}
            );
            toast.success('New option added');

            // Prefer returned id/value/name
            const value =
                data?.id ?? data?.value ?? data?.name ?? newOptionValue.trim();

            if (groupIndex != null) {
                handleChange(
                    {target: {name: field.name, value}},
                    field.group,
                    groupIndex,
                    field.name
                );
            } else {
                handleChange({target: {name: field.name, value}});
            }
            setModalState({isOpen: false, field: null, groupIndex: null});
            setNewOptionValue('');
        } catch {
            toast.error('Failed to add new');
        }
    };

    if (loading) return <p className="m-2">Loading...</p>;

    return (
        <div className="container py-4">
            <div className="card p-4">
                <h3 className="mb-4">{title}</h3>

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        {fields.map((field, fieldIndex) => {
                            // ---------- non-repeatable ----------
                            if (!field.repeatable) {
                                const valuePrimitive = field.group
                                    ? form[field.group]?.[field.name]
                                    : form[field.name];

                                const isAsync = field.type === 'async-select';
                                const isMultiAsync = field.type === 'multi-async-select';
                                const isSelect = field.type === 'select';
                                const isTextArea = field.type === 'textarea';
                                const isCheckbox = field.type === 'checkbox';
                                const isFile = field.type === 'file';

                                return (
                                    <div key={`${field.name}-${fieldIndex}`} className="col-md-6 mb-3">
                                        <label className="form-label">{field.label}</label>

                                        {isAsync || isMultiAsync ? (
                                            <AsyncSelect
                                                cacheOptions
                                                defaultOptions
                                                isMulti={isMultiAsync}
                                                loadOptions={field.loadOptions}
                                                name={field.name}
                                                isDisabled={!editMode || field.disabled}
                                                value={valuePrimitive || (isMultiAsync ? [] : null)} // normalized
                                                onChange={(selected) =>
                                                    handleChange({
                                                        target: {
                                                            name: field.name,
                                                            value: selected ?? (isMultiAsync ? [] : null),
                                                        },
                                                    })
                                                }
                                                isClearable
                                                noOptionsMessage={defaultNoOptions(() =>
                                                    setModalState({isOpen: true, field, groupIndex: null})
                                                )}
                                            />
                                        ) : isSelect ? (
                                            <Select
                                                classNamePrefix="react-select"
                                                name={field.name}
                                                options={field.options || []}
                                                isDisabled={!editMode || field.disabled}
                                                value={reactSelectValueFromPrimitive(field.options, valuePrimitive)}
                                                onChange={(selected) =>
                                                    handleChange({
                                                        target: {
                                                            name: field.name,
                                                            value: selected?.value ?? null,
                                                        },
                                                    })
                                                }
                                                isClearable
                                            />
                                        ) : isTextArea ? (
                                            <textarea
                                                className="form-control"
                                                name={field.name}
                                                value={valuePrimitive ?? ''}
                                                disabled={!editMode || field.disabled}
                                                onChange={handleChange}
                                            />
                                        ) : isCheckbox ? (
                                            <div className="form-check form-switch">
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    name={field.name}
                                                    checked={!!valuePrimitive}
                                                    disabled={!editMode || field.disabled}
                                                    onChange={handleChange}
                                                />
                                                <label className="form-check-label">{field.label}</label>
                                            </div>
                                        ) : isFile ? (
                                            <>
                                                {previews[field.name] && (
                                                    <img
                                                        src={previews[field.name]}
                                                        alt="Preview"
                                                        className="img-thumbnail mb-2"
                                                        width={100}
                                                    />
                                                )}
                                                <input
                                                    type="file"
                                                    className="form-control"
                                                    name={field.name}
                                                    disabled={!editMode || field.disabled}
                                                    onChange={handleChange}
                                                />
                                            </>
                                        ) : (
                                            <input
                                                type={field.type || 'text'}
                                                className="form-control"
                                                name={field.name}
                                                value={valuePrimitive ?? ''}
                                                disabled={!editMode || field.disabled}
                                                onChange={handleChange}
                                            />
                                        )}

                                        {errors[field.name] && (
                                            <small className="text-danger">{errors[field.name]}</small>
                                        )}
                                    </div>
                                );
                            }

                            // ---------- repeatable (formset-like) ----------
                            return (
                                <div key={`group-${field.group}-${fieldIndex}`} className="col-12 mb-4">
                                    <label className="form-label fw-bold">{field.label}</label>

                                    <div className="mb-2">
                                        <table className="table table-bordered table-sm">
                                            <thead>
                                            <tr>
                                                {(field.fields || []).map((sub, subIndex) => (
                                                    <th key={`${field.group}-header-${sub.name}-${subIndex}`}>{sub.label}</th>
                                                ))}
                                                {editMode && <th>Actions</th>}
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {(form[field.group] || []).map((item, index) => (
                                                <tr key={`${field.group}-row-${index}`}>
                                                    {(field.fields || []).map((sub, subIndex) => {
                                                        const subVal = item?.[sub.name];
                                                        const subAsync = sub.type === 'async-select';
                                                        const subMultiAsync = sub.type === 'multi-async-select';
                                                        const subSelect = sub.type === 'select';

                                                        return (
                                                            <td key={`${field.group}-${index}-${sub.name}-${subIndex}`}>
                                                                {subAsync || subMultiAsync ? (
                                                                    <AsyncSelect
                                                                        cacheOptions
                                                                        defaultOptions
                                                                        isMulti={subMultiAsync}
                                                                        loadOptions={sub.loadOptions}
                                                                        name={sub.name}
                                                                        value={subVal || (subMultiAsync ? [] : null)}
                                                                        isDisabled={!editMode || sub.disabled}
                                                                        onChange={(selected) =>
                                                                            handleChange(
                                                                                {
                                                                                    target: {
                                                                                        name: sub.name,
                                                                                        value: selected ?? (subMultiAsync ? [] : null),
                                                                                    },
                                                                                },
                                                                                field.group,
                                                                                index,
                                                                                sub.name
                                                                            )
                                                                        }
                                                                        isClearable
                                                                        noOptionsMessage={defaultNoOptions(() =>
                                                                            setModalState({
                                                                                isOpen: true,
                                                                                field: sub,
                                                                                groupIndex: index,
                                                                            })
                                                                        )}
                                                                    />
                                                                ) : subSelect ? (
                                                                    <Select
                                                                        classNamePrefix="react-select"
                                                                        name={sub.name}
                                                                        options={sub.options || []}
                                                                        isDisabled={!editMode || sub.disabled}
                                                                        value={reactSelectValueFromPrimitive(sub.options, subVal)}
                                                                        onChange={(selected) =>
                                                                            handleChange(
                                                                                {
                                                                                    target: {
                                                                                        name: sub.name,
                                                                                        value: selected?.value ?? null,
                                                                                    },
                                                                                },
                                                                                field.group,
                                                                                index,
                                                                                sub.name
                                                                            )
                                                                        }
                                                                        isClearable
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type={sub.type || 'text'}
                                                                        className="form-control"
                                                                        name={sub.name}
                                                                        value={subVal ?? ''}
                                                                        disabled={!editMode || sub.disabled}
                                                                        onChange={(e) => handleChange(e, field.group, index, sub.name)}
                                                                    />
                                                                )}

                                                                {errors[`${field.group}.${index}.${sub.name}`] && (
                                                                    <small className="text-danger">
                                                                        {errors[`${field.group}.${index}.${sub.name}`]}
                                                                    </small>
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                    {editMode && (
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => {
                                                                    const updated = [...(form[field.group] || [])];
                                                                    updated.splice(index, 1);
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        [field.group]: updated,
                                                                    }));
                                                                }}
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {editMode && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() => {
                                                const empty = (field.fields || []).reduce((acc, sub) => {
                                                    acc[sub.name] = sub.type === 'checkbox' ? false : '';
                                                    return acc;
                                                }, {});
                                                setForm((prev) => ({
                                                    ...prev,
                                                    [field.group]: [...(prev[field.group] || []), empty],
                                                }));
                                            }}
                                        >
                                            + Add {field.label}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {editMode ? (
                        <div className="d-flex gap-2">
                            <button type="submit" className="btn btn-success">Save</button>
                            {method !== 'POST' && (
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setEditMode(false)}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{backgroundColor: '#e16123', border: 'none'}}
                            onClick={() => setEditMode(true)}
                        >
                            Edit
                        </button>
                    )}
                </form>
            </div>

            <Modal
                isOpen={modalState.isOpen}
                onRequestClose={() =>
                    setModalState({isOpen: false, field: null, groupIndex: null})
                }
                className="ReactModal__Content"
                overlayClassName="ReactModal__Overlay"
            >
                <div className="modal-content p-4">
                    <h5>Add New</h5>
                    <input
                        className="form-control mb-2"
                        value={newOptionValue}
                        onChange={(e) => setNewOptionValue(e.target.value)}
                        placeholder="Enter name…"
                    />
                    <div className="d-flex justify-content-end gap-2">
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() =>
                                setModalState({isOpen: false, field: null, groupIndex: null})
                            }
                        >
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateNewOption}>
                            Add
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GenericForm;
