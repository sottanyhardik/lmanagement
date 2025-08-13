// src/pages/Allotment/AllotmentFilters.jsx
import React from 'react';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect.jsx';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect.jsx';
import YesNoRadio from '../../components/YesNoRadio';
import {Form} from 'react-bootstrap';

const AllotmentFilters = ({filters, setFilters}) => (
    <>
        <AsyncCompanySelect
            key="company" value={filters.company}
            onChange={v => setFilters(prev => ({...prev, company: v}))}
            placeholder="Company"
        />
        <AsyncPortSelect
            key="port" value={filters.port}
            onChange={v => setFilters(prev => ({...prev, port: v}))}
            placeholder="Port"
        />
        <AsyncCompanySelect
            key="rel_company" value={filters.related_company}
            onChange={v => setFilters(prev => ({...prev, related_company: v}))}
            placeholder="Related Company"
        />
        <Form.Control
            key="invoice" size="sm" placeholder="Invoice"
            value={filters.invoice || ''}
            onChange={e => setFilters(prev => ({...prev, invoice: e.target.value}))}
        />
        <Form.Control
            key="item_name" size="sm" placeholder="Item Name"
            value={filters.item_name || ''}
            onChange={e => setFilters(prev => ({...prev, item_name: e.target.value}))}
        />
        <Form.Control
            key="license_number" size="sm" placeholder="License Number"
            value={filters.license_number || ''}
            onChange={e => setFilters(prev => ({...prev, license_number: e.target.value}))}
        />
        <Form.Control
            key="hs_code" size="sm" placeholder="HS Code"
            value={filters.hs_code || ''}
            onChange={e => setFilters(prev => ({...prev, hs_code: e.target.value}))}
        />
        <AsyncCompanySelect
            key="exporter" value={filters.exporter}
            onChange={v => setFilters(prev => ({...prev, exporter: v}))}
            placeholder="Exporter"
        />
        <Form.Control
            key="from_date" size="sm" type="date" value={filters.date_from || ''}
            onChange={e => setFilters(prev => ({...prev, date_from: e.target.value}))}
        />
        <Form.Control
            key="to_date" size="sm" type="date" value={filters.date_to || ''}
            onChange={e => setFilters(prev => ({...prev, date_to: e.target.value}))}
        />
        <YesNoRadio
            key="has_balance" label="Has Balance?"
            value={filters.has_balance}
            onChange={val => setFilters(prev => ({...prev, has_balance: val}))}
        />
        <YesNoRadio
            key="include_assigned" label="Show All With BOE?"
            value={filters.include_assigned}
            onChange={val => setFilters(prev => ({...prev, include_assigned: val}))}
        />
    </>
);

export default AllotmentFilters;
