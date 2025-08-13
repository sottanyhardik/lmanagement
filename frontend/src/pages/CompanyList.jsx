// src/pages/CompanyList.jsx
import GenericList from '../layouts/GenericList';

const fields = [
    {name: 'iec', label: 'IEC'},
    {name: 'name', label: 'Name'},
    {name: 'pan', label: 'PAN'},
    {name: 'gst_number', label: 'GSTIN'},
    {name: 'address_line_1', label: 'Address 1'},
    {name: 'address_line_2', label: 'Address 2'},
];

const initialItem = {
    iec: '',
    name: '',
    pan: '',
    gst_number: '',
    address_line_1: '',
    address_line_2: '',
};

const validateCompany = (item) => {
    const errors = {};
    const iec = (item.iec || '').trim().toUpperCase();
    const name = (item.name || '').trim();
    const pan = (item.pan || '').trim().toUpperCase();
    const gst = (item.gst_number || '').trim().toUpperCase();

    // IEC: 10 alphanumeric
    if (!iec || !/^[A-Z0-9]{10}$/i.test(iec)) {
        errors.iec = 'IEC must be 10 alphanumeric characters';
    }

    if (!name) {
        errors.name = 'Name is required';
    }

    // PAN: 5 letters + 4 digits + 1 letter
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        errors.pan = 'PAN must be 10 chars: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)';
    }

    // GSTIN: 2 digits + PAN + 1 alnum + Z + 1 alnum
    if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gst)) {
        errors.gst_number = 'GSTIN must be 15 chars (e.g., 27ABCDE1234F1Z5)';
    }

    // Cross-check: PAN inside GSTIN (chars 3-12) must match PAN
    if (pan && gst && gst.length === 15 && gst.slice(2, 12) !== pan) {
        errors.gst_number = 'GSTIN PAN segment does not match PAN';
    }

    return errors;
};

export default function CompanyList() {
    return (
        <GenericList
            resource="companies"           // axiosInstance has /api baseURL
            title="📋 Company List"
            fields={fields}
            initialItem={initialItem}
            validateItem={validateCompany}
            virtualized                    // enable sticky-header virtualization
            height={600}
            rowHeight={44}
        />
    );
}
