import GenericList from '../layouts/GenericList';

const fields = [
    {name: 'iec', label: 'IEC'},
    {name: 'name', label: 'Name'},
    {name: 'address_line_1', label: 'Address 1'},
    {name: 'address_line_2', label: 'Address 2'},
];

const initialItem = {
    iec: '',
    name: '',
    address_line_1: '',
    address_line_2: '',
};

const validateCompany = (item) => {
    const errors = {};
    if (!item.iec || !/^[A-Z0-9]{10}$/i.test(item.iec.trim())) {
        errors.iec = 'IEC must be 10 alphanumeric characters';
    }
    if (!item.name?.trim()) errors.name = 'Name is required';
    return errors;
};

const CompanyList = () => {
    return (
        <GenericList
            resource="api/companies"
            title="📋 Company List"
            fields={fields}
            initialItem={initialItem}
            validateItem={validateCompany}
        />
    );
};

export default CompanyList;
