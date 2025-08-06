import React, {useEffect, useState} from 'react';
import axios from 'axios';
import {useFieldArray, useForm} from 'react-hook-form';
import 'bootstrap/dist/css/bootstrap.min.css';

const currencyOptions = ['usd', 'euro'];
const unitOptions = ['kg'];

const LicenseForm = ({licenseId, onSuccess}) => {
    const [loading, setLoading] = useState(false);
    const {register, control, handleSubmit, reset, formState: {errors}} = useForm({
        defaultValues: {export_items: [], import_items: []}
    });

    const {fields: exportFields, append: appendExport, remove: removeExport} = useFieldArray({
        control,
        name: 'export_items'
    });
    const {fields: importFields, append: appendImport, remove: removeImport} = useFieldArray({
        control,
        name: 'import_items'
    });

    useEffect(() => {
        if (licenseId) {
            axios.get(`/api/licenses/${licenseId}/`).then(res => reset(res.data));
        }
    }, [licenseId, reset]);

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            const method = licenseId ? 'put' : 'post';
            const url = licenseId ? `/api/licenses/${licenseId}/` : `/api/licenses/`;
            const response = await axios[method](url, data);
            onSuccess(response.data);
        } catch (err) {
            alert('Submission failed: ' + (err.response?.data?.detail || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
            <h3>License Details</h3>
            <div className="row g-3 mb-3">
                <div className="col-md-6">
                    <label>License Number</label>
                    <input className="form-control" {...register('license_number', {required: true})} />
                    {errors.license_number && <small className="text-danger">Required</small>}
                </div>
                <div className="col-md-3">
                    <label>Scheme Code</label>
                    <input className="form-control" {...register('scheme_code')} />
                </div>
                <div className="col-md-3">
                    <label>Notification Number</label>
                    <input className="form-control" {...register('notification_number')} />
                </div>
                <div className="col-md-6">
                    <label>License Date</label>
                    <input type="date" className="form-control" {...register('license_date')} />
                </div>
                <div className="col-md-6">
                    <label>Expiry Date</label>
                    <input type="date" className="form-control" {...register('license_expiry_date')} />
                </div>
            </div>

            <h4>Export Items</h4>
            {exportFields.map((item, idx) => (
                <div className="row g-2 mb-2" key={item.id}>
                    <input type="hidden" {...register(`export_items.${idx}.id`)} />
                    <div className="col-md-4">
                        <input placeholder="Net Quantity" className="form-control"
                               {...register(`export_items.${idx}.net_quantity`, {
                                   required: true,
                                   min: 1
                               })} />
                        {errors.export_items?.[idx]?.net_quantity &&
                            <small className="text-danger">Required and positive</small>}
                    </div>
                    <div className="col-md-3">
                        <select className="form-select" {...register(`export_items.${idx}.currency`)}>
                            {currencyOptions.map(cur => <option key={cur} value={cur}>{cur.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <input placeholder="CIF FC" className="form-control" type="number"
                               {...register(`export_items.${idx}.cif_fc`, {required: true})} />
                    </div>
                    <div className="col-md-2">
                        <button type="button" className="btn btn-outline-danger"
                                onClick={() => removeExport(idx)}>Remove
                        </button>
                    </div>
                </div>
            ))}
            <button type="button" className="btn btn-outline-primary mb-3" onClick={() => appendExport({})}>
                Add Export Item
            </button>

            <h4>Import Items</h4>
            {importFields.map((item, idx) => (
                <div className="row g-2 mb-2" key={item.id}>
                    <input type="hidden" {...register(`import_items.${idx}.id`)} />
                    <div className="col-md-2">
                        <input placeholder="Serial #" className="form-control"
                               {...register(`import_items.${idx}.serial_number`, {required: true})} />
                        {errors.import_items?.[idx]?.serial_number && <small className="text-danger">Required</small>}
                    </div>
                    <div className="col-md-4">
                        <input placeholder="Description" className="form-control"
                               {...register(`import_items.${idx}.description`, {required: true})} />
                        {errors.import_items?.[idx]?.description && <small className="text-danger">Required</small>}
                    </div>
                    <div className="col-md-3">
                        <input placeholder="Quantity" className="form-control" type="number"
                               {...register(`import_items.${idx}.quantity`, {required: true, min: 0})} />
                        {errors.import_items?.[idx]?.quantity &&
                            <small className="text-danger">Must be positive</small>}
                    </div>
                    <div className="col-md-2">
                        <select className="form-select" {...register(`import_items.${idx}.unit`)}>
                            {unitOptions.map(unit => <option key={unit} value={unit}>{unit.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="col-md-1">
                        <button type="button" className="btn btn-outline-danger" onClick={() => removeImport(idx)}>X
                        </button>
                    </div>
                </div>
            ))}
            <button type="button" className="btn btn-outline-primary mb-3" onClick={() => appendImport({})}>
                Add Import Item
            </button>

            <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Saving...' : licenseId ? 'Update License' : 'Create License'}
            </button>
        </form>
    );
};

export default LicenseForm;
