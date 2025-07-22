import {useEffect, useState} from 'react';
import {toast} from 'react-toastify';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';
import Modal from 'react-modal';
import './GenericForm.css';
import './ModalFix.css';

const GenericForm = ({
                         apiEndpoint,
                         fields,
                         token,
                         title = 'Update',
                         method = 'PUT',
                         fetchOnLoad = true,
                         initialData = {},
                     }) => {
    const [form, setForm] = useState(initialData);
    const [editMode, setEditMode] = useState(method === 'POST');
    const [loading, setLoading] = useState(fetchOnLoad);
    const [errors, setErrors] = useState({});
    const [previews, setPreviews] = useState({});
    const [modalState, setModalState] = useState({isOpen: false, field: null, groupIndex: null});
    const [newOptionValue, setNewOptionValue] = useState('');

    useEffect(() => {
        if (!fetchOnLoad || method === 'POST') return;

        const fetchData = async () => {
            try {
                const response = await fetch(apiEndpoint, {
                    headers: {Authorization: `Bearer ${token}`},
                });
                if (!response.ok) throw new Error('Failed to fetch');
                const data = await response.json();

                const normalized = {...data};

                for (const field of fields) {
                    const val = normalized[field.name];

                    if (field.type === 'async-select' && val && typeof val === 'object') {
                        normalized[field.name] = {
                            value: val.id,
                            label: val.name || val.hs_code || val.label || '—',
                        };
                    }

                    if (field.type === 'multi-async-select' && Array.isArray(val)) {
                        normalized[field.name] = val.map(item => ({
                            value: item.id,
                            label: `${item.hs_code} - ${item.product_description || ''}`.trim(),
                        }));
                    }

                    if (field.type === 'group' && typeof val === 'object') {
                        for (const sub of field.fields) {
                            const subVal = val[sub.name];

                            if (sub.type === 'async-select' && subVal && typeof subVal === 'object') {
                                normalized[field.name][sub.name] = {
                                    value: subVal.id,
                                    label: subVal.name || subVal.hs_code || subVal.label || '—',
                                };
                            }

                            if (sub.type === 'multi-async-select' && Array.isArray(subVal)) {
                                normalized[field.name][sub.name] = subVal.map(item => ({
                                    value: item.id,
                                    label: `${item.hs_code} - ${item.product_description || ''}`.trim(),
                                }));
                            }
                        }
                    }

                    if (field.type === 'formset' && Array.isArray(val)) {
                        normalized[field.name] = val.map(entry => {
                            const updated = {...entry};
                            for (const sub of field.fields) {
                                const subVal = entry[sub.name];

                                if (sub.type === 'async-select' && subVal && typeof subVal === 'object') {
                                    updated[sub.name] = {
                                        value: subVal.id,
                                        label: subVal.name || subVal.hs_code || subVal.label || '—',
                                    };
                                }

                                if (sub.type === 'multi-async-select' && Array.isArray(subVal)) {
                                    updated[sub.name] = subVal.map(item => ({
                                        value: item.id,
                                        label: `${item.hs_code} - ${item.product_description || ''}`.trim(),
                                    }));
                                }
                            }
                            return updated;
                        });
                    }
                }

                setForm(normalized);
                setLoading(false);
            } catch {
                toast.error('Failed to load data');
                setLoading(false);
            }
        };

        fetchData();
    }, [apiEndpoint, token, fetchOnLoad, method, fields]);

    const handleChange = (e, group = null, index = null, subfield = null) => {
        const {name, type, checked, files, value} = e.target;
        let fieldValue = value;
        if (type === 'checkbox') fieldValue = checked;
        if (type === 'file') {
            fieldValue = files[0];
            if (fieldValue?.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => setPreviews((prev) => ({...prev, [name]: reader.result}));
                reader.readAsDataURL(fieldValue);
            }
        }
        setErrors((prev) => ({...prev, [name]: ''}));
        if (group && index !== null && subfield) {
            setForm((prev) => {
                const updated = [...(prev[group] || [])];
                updated[index] = {...updated[index], [subfield]: fieldValue};
                return {...prev, [group]: updated};
            });
        } else if (group) {
            setForm((prev) => ({...prev, [group]: {...prev[group], [name]: fieldValue}}));
        } else {
            setForm((prev) => ({...prev, [name]: fieldValue}));
        }
    };

    const validate = () => {
        const newErrors = {};
        fields.forEach((field) => {
            if (field.repeatable) {
                (form[field.group] || []).forEach((item, index) => {
                    field.fields.forEach((subfield) => {
                        const val = item[subfield.name];
                        if (subfield.required && !val) {
                            newErrors[`${field.group}.${index}.${subfield.name}`] = `${subfield.label} is required`;
                        }
                    });
                });
            } else {
                const val = field.group ? form[field.group]?.[field.name] : form[field.name];
                if (field.required && !val) {
                    newErrors[field.name] = `${field.label} is required`;
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const isMultipart = fields.some((f) => f.type === 'file');
        const payload = isMultipart ? new FormData() : {};

        fields.forEach((field) => {
            if (field.repeatable) {
                if (isMultipart) {
                    payload.append(field.group, JSON.stringify(form[field.group]));
                } else {
                    payload[field.group] = form[field.group];
                }
            } else {
                const val = field.group ? form[field.group]?.[field.name] : form[field.name];
                if (isMultipart) {
                    payload.append(field.name, val);
                } else {
                    payload[field.name] = val;
                }
            }
        });

        const response = await fetch(apiEndpoint, {
            method,
            headers: isMultipart ? {Authorization: `Bearer ${token}`} : {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: isMultipart ? payload : JSON.stringify(payload),
        });

        if (response.ok) {
            toast.success(`${title} successful`);
            if (method !== 'POST') setEditMode(false);
        } else {
            const errorData = await response.json();
            if (errorData && typeof errorData === 'object') {
                const apiErrors = Object.entries(errorData).reduce((acc, [key, value]) => {
                    acc[key] = Array.isArray(value) ? value.join(', ') : value;
                    return acc;
                }, {});
                setErrors(apiErrors);
                toast.error(`${title} failed: Check form fields`);
            } else {
                toast.error(`${title} failed`);
            }
        }
    };

    const handleCreateNewOption = async () => {
        const {field, groupIndex} = modalState;
        try {
            const response = await fetch(field.createEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({name: newOptionValue}),
            });
            const data = await response.json();
            if (response.ok) {
                toast.success('New option added');
                if (groupIndex !== null) {
                    handleChange({target: {name: field.name, value: data.name}}, field.group, groupIndex, field.name);
                } else {
                    handleChange({target: {name: field.name, value: data.name}});
                }
                setModalState({isOpen: false, field: null, groupIndex: null});
                setNewOptionValue('');
            } else {
                toast.error('Failed to add new');
            }
        } catch {
            toast.error('Failed to add new');
        }
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div className="container py-4">
            <div className="card p-4">
                <h3 className="mb-4">{title}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="row">
                        {fields.map((field, fieldIndex) => {
                            if (!field.repeatable) {
                                return (
                                    <div key={`${field.name}-${fieldIndex}`} className="col-md-6 mb-3">
                                        <label className="form-label">{field.label}</label>
                                        {field.type === 'select' && field.async ? (
                                            <AsyncSelect
                                                cacheOptions
                                                defaultOptions
                                                loadOptions={field.loadOptions}
                                                name={field.name}
                                                isDisabled={!editMode || field.disabled}
                                                value={form[field.name] ? {
                                                    label: form[field.name],
                                                    value: form[field.name]
                                                } : null}
                                                onChange={(selected) =>
                                                    handleChange({target: {name: field.name, value: selected?.value}})
                                                }
                                                isClearable
                                                noOptionsMessage={() => (
                                                    <span>
                            No options.{' '}
                                                        <button
                                                            type="button"
                                                            className="btn btn-link p-0"
                                                            onClick={() => setModalState({
                                                                isOpen: true,
                                                                field,
                                                                groupIndex: null
                                                            })}
                                                        >
                              Add new
                            </button>
                          </span>
                                                )}
                                            />
                                        ) : field.type === 'select' ? (
                                            <Select
                                                classNamePrefix="react-select"
                                                name={field.name}
                                                options={field.options || []}
                                                isDisabled={!editMode || field.disabled}
                                                value={field.options?.find((opt) => opt.value === form[field.name]) || null}
                                                onChange={(selected) =>
                                                    handleChange({target: {name: field.name, value: selected?.value}})
                                                }
                                                isClearable
                                            />
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                className="form-control"
                                                name={field.name}
                                                value={form[field.name] || ''}
                                                disabled={!editMode || field.disabled}
                                                onChange={handleChange}
                                            />
                                        ) : field.type === 'checkbox' ? (
                                            <div className="form-check form-switch">
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    name={field.name}
                                                    checked={!!form[field.name]}
                                                    disabled={!editMode || field.disabled}
                                                    onChange={handleChange}
                                                />
                                                <label className="form-check-label">{field.label}</label>
                                            </div>
                                        ) : field.type === 'file' ? (
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
                                                value={form[field.name] || ''}
                                                disabled={!editMode || field.disabled}
                                                onChange={handleChange}
                                            />
                                        )}
                                        {errors[field.name] &&
                                            <small className="text-danger">{errors[field.name]}</small>}
                                    </div>
                                );
                            }

                            return (
                                <div key={`group-${field.group}-${fieldIndex}`} className="col-12 mb-4">
                                    <label className="form-label fw-bold">{field.label}</label>
                                    <div className="mb-2">
                                        <table className="table table-bordered table-sm">
                                            <thead>
                                            <tr>
                                                {field.fields.map((sub, subIndex) => (
                                                    <th key={`${field.group}-header-${sub.name}-${subIndex}`}>{sub.label}</th>
                                                ))}
                                                {editMode && <th>Actions</th>}
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {(form[field.group] || []).map((item, index) => (
                                                <tr key={`${field.group}-row-${index}`}>
                                                    {field.fields.map((sub, subIndex) => (
                                                        <td key={`${field.group}-${index}-${sub.name}-${subIndex}`}>
                                                            {sub.type === 'select' && sub.async ? (
                                                                <AsyncSelect
                                                                    cacheOptions
                                                                    defaultOptions
                                                                    loadOptions={sub.loadOptions}
                                                                    name={sub.name}
                                                                    value={
                                                                        item[sub.name]
                                                                            ? {
                                                                                label: item[sub.name],
                                                                                value: item[sub.name]
                                                                            }
                                                                            : null
                                                                    }
                                                                    isDisabled={!editMode || sub.disabled}
                                                                    onChange={(selected) =>
                                                                        handleChange(
                                                                            {
                                                                                target: {
                                                                                    name: sub.name,
                                                                                    value: selected?.value
                                                                                }
                                                                            },
                                                                            field.group,
                                                                            index,
                                                                            sub.name
                                                                        )
                                                                    }
                                                                    isClearable
                                                                    noOptionsMessage={() => (
                                                                        <span>
                                        No options.{' '}
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-link p-0"
                                                                                onClick={() =>
                                                                                    setModalState({
                                                                                        isOpen: true,
                                                                                        field: sub,
                                                                                        groupIndex: index,
                                                                                    })
                                                                                }
                                                                            >
                                          Add new
                                        </button>
                                      </span>
                                                                    )}
                                                                />
                                                            ) : sub.type === 'select' ? (
                                                                <Select
                                                                    classNamePrefix="react-select"
                                                                    name={sub.name}
                                                                    options={sub.options || []}
                                                                    isDisabled={!editMode || sub.disabled}
                                                                    value={
                                                                        sub.options?.find((opt) => opt.value === item[sub.name]) || null
                                                                    }
                                                                    onChange={(selected) =>
                                                                        handleChange(
                                                                            {
                                                                                target: {
                                                                                    name: sub.name,
                                                                                    value: selected?.value
                                                                                }
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
                                                                    value={item[sub.name] || ''}
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
                                                    ))}
                                                    {editMode && (
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => {
                                                                    const updated = [...form[field.group]];
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
                                                const emptyEntry = field.fields.reduce((acc, sub) => {
                                                    acc[sub.name] = '';
                                                    return acc;
                                                }, {});
                                                setForm((prev) => ({
                                                    ...prev,
                                                    [field.group]: [...(prev[field.group] || []), emptyEntry],
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
                                <button type="button" className="btn btn-success"
                                        onClick={() => setEditMode(false)}>Cancel</button>
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
                onRequestClose={() => setModalState({isOpen: false, field: null, groupIndex: null})}
                className="ReactModal__Content"
                overlayClassName="ReactModal__Overlay"
            >
                <div className="modal-content p-4">
                    <h5>Add New</h5>
                    <input
                        className="form-control mb-2"
                        value={newOptionValue}
                        onChange={(e) => setNewOptionValue(e.target.value)}
                        placeholder="Enter name..."
                    />
                    <div className="d-flex justify-content-end gap-2">
                        <button
                            className="btn btn-success"
                            onClick={() => setModalState({isOpen: false, field: null, groupIndex: null})}
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
