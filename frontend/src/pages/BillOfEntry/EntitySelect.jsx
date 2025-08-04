import React, {useEffect, useState} from 'react';
import {Form} from 'react-bootstrap';
import {fetchEntities} from '../../Cache/entityCache';

const EntitySelect = ({value, onChange}) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadEntities() {
            const entities = await fetchEntities();
            setOptions(entities);
            setLoading(false);
        }

        loadEntities();
    }, []);

    const handleChange = (e) => {
        const selectedId = parseInt(e.target.value);
        const selectedEntity = options.find(opt => opt.id === selectedId);
        onChange(selectedEntity || null);
    };

    return (
        <Form.Select value={value?.id || ''} onChange={handleChange} disabled={loading}>
            <option value="">Select Entity</option>
            {options.map(ent => (
                <option key={ent.id} value={ent.id}>
                    {ent.name} — {ent.pan_number || 'No PAN'} — {ent.gst_number || 'No GST'}
                </option>
            ))}
        </Form.Select>
    );
};

export default EntitySelect;
