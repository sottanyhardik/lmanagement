// pages/License/LicenseFilters.jsx
import React from 'react';
import AsyncCompanySelect from '../../components/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncPortSelect';
import {Form} from 'react-bootstrap';

const LicenseFilters = ({filters, setFilters}) => (
    <>
        <AsyncCompanySelect
            isMulti
            placeholder="Exporter"
            value={filters.exporter_objs}
            onChange={v => setFilters(prev => ({...prev, exporter_objs: v}))}
        />
        <AsyncPortSelect
            isMulti
            placeholder="Port"
            value={filters.port_objs}
            onChange={v => setFilters(prev => ({...prev, port_objs: v}))}
        />
        <Form.Control
            size="sm"
            placeholder="License Number"
            value={filters.license_number || ''}
            onChange={e => setFilters(prev => ({...prev, license_number: e.target.value}))}
        />
        <Form.Control
            size="sm"
            type="date"
            value={filters.from_date || ''}
            onChange={e => setFilters(prev => ({...prev, from_date: e.target.value}))}
        />
        <Form.Control
            size="sm"
            type="date"
            value={filters.to_date || ''}
            onChange={e => setFilters(prev => ({...prev, to_date: e.target.value}))}
        />
    </>
);

export default LicenseFilters;
