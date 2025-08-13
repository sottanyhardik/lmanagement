// src/pages/PortList.jsx
import React from 'react';
import GenericList from '../layouts/GenericList';

const validatePort = (item) => {
    const errors = {};
    if (!item.code?.trim()) errors.code = 'Code is required';
    if (!item.name?.trim()) errors.name = 'Name is required';
    return errors;
};

const fields = [
    {name: 'code', label: 'Port Code'},
    {name: 'name', label: 'Port Name'},
];

const initialItem = {code: '', name: ''};

export default function PortList() {
    return (
        <GenericList
            resource="ports"          // ✅ axios baseURL '/api/' adds the prefix
            title="📋 Port List"
            fields={fields}
            validateItem={validatePort}
            initialItem={initialItem}
        />
    );
}
