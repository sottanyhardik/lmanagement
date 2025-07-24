import React from 'react';
import GenericList from '../layouts/GenericList';

// Validation logic
const validatePort = (item) => {
    const errors = {};
    if (!item.code || item.code.trim() === '') {
        errors.code = 'Code is required';
    }
    if (!item.name || item.name.trim() === '') {
        errors.name = 'Name is required';
    }
    return errors;
};

// Field definitions
const fields = [
    {name: 'code', label: 'Port Code'},
    {name: 'name', label: 'Port Name'},
];

// Initial object for add modal
const initialItem = {
    code: '',
    name: '',
};

const PortList = () => {
    return (
        <GenericList
            resource="api/ports" // your Django API endpoint should be `/api/ports/`
            title="📋 Port List"
            fields={fields}
            validateItem={validatePort}
            initialItem={initialItem}
        />
    );
};

export default PortList;
