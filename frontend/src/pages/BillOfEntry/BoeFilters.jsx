// src/components/BoeFilters.jsx
import React from 'react';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect.jsx';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect.jsx';
import YesNoRadio from '../../components/YesNoRadio';
import {Form} from 'react-bootstrap';

const BoeFilters = ({filters, setFilters}) => (
    <>
        <AsyncCompanySelect
            key="company" isMulti value={filters.company_objs}
            onChange={v => setFilters(prev => ({...prev, company_objs: v}))}
        />
        <AsyncCompanySelect
            key="exclude_company" isMulti placeholder="Exclude Company" value={filters.exclude_company_objs}
            onChange={v => setFilters(prev => ({...prev, exclude_company_objs: v}))}
        />
        <AsyncPortSelect
            key="port" isMulti value={filters.port_objs}
            onChange={v => setFilters(prev => ({...prev, port_objs: v}))}
        />
        <AsyncPortSelect
            key="exclude_port" isMulti placeholder="Exclude Port" value={filters.exclude_port_objs}
            onChange={v => setFilters(prev => ({...prev, exclude_port_objs: v}))}
        />
        <Form.Control
            key="product" size="sm" placeholder="Product Name" value={filters.product_name}
            onChange={e => setFilters(prev => ({...prev, product_name: e.target.value}))}
        />
        <YesNoRadio
            key="is_invoice" label="Has Invoice?" value={filters.is_invoice}
            onChange={val => setFilters(prev => ({...prev, is_invoice: val}))}
        />
        <Form.Control
            key="from_date" size="sm" type="date" value={filters.from_date}
            onChange={e => setFilters(prev => ({...prev, from_date: e.target.value}))}
        />
        <Form.Control
            key="to_date" size="sm" type="date" value={filters.to_date}
            onChange={e => setFilters(prev => ({...prev, to_date: e.target.value}))}
        />
    </>
);

export default BoeFilters;
