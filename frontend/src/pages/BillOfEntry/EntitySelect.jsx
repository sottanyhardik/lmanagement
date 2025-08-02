import React, {useEffect, useState} from 'react';
import {Form} from 'react-bootstrap';
import axios from '../../api/axiosInstance';

const EntitySelect = ({value, onChange}) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('/api/invoice-entities/')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : res.data.results || [];
                setOptions(data);
            })
            .catch(err => {
                console.error('Failed to load entities:', err);
                setOptions([]);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (e) => {
        const selectedId = parseInt(e.target.value);
        const selectedEntity = options.find(opt => opt.id === selectedId);
        onChange(selectedEntity || null);
    };

    return (
        <Form.Select value={value?.id || ''} onChange={handleChange} disabled={loading}>
            <option value="">Select Entity</option>
            {Array.isArray(options) && options.map(ent => (
                <option key={ent.id} value={ent.id}>
                    {ent.name} — {ent.pan_number || 'No PAN'} — {ent.gst_number || 'No GST'}
                </option>
            ))}
        </Form.Select>
    );
};

export default EntitySelect;
