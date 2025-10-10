// src/components/BoeFilters.jsx
import React from 'react';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect';
import YesNoRadio from '../../components/YesNoRadio';
import {Col, Form, Row} from 'react-bootstrap';

const BoeFilters = ({filters, setFilters}) => (
    <Row className="g-3">
        <Col xs={12} sm={6} md={4}>
            <Form.Group className="mb-0">
                <Form.Label className="mb-1 text-muted small fw-semibold">Company</Form.Label>
                <AsyncCompanySelect
                    isMulti
                    value={filters.company_objs}
                    onChange={v => setFilters(prev => ({...prev, company_objs: v}))}
                />
            </Form.Group>
        </Col>

        <Col xs={12} sm={6} md={4}>
            <Form.Group className="mb-0">
                <Form.Label className="mb-1 text-muted small fw-semibold">Exclude Company</Form.Label>
                <AsyncCompanySelect
                    isMulti
                    placeholder="Exclude Company"
                    value={filters.exclude_company_objs}
                    onChange={v => setFilters(prev => ({...prev, exclude_company_objs: v}))}
                />
            </Form.Group>
        </Col>

        <Col xs={12} sm={6} md={4}>
            <Form.Group className="mb-0">
                <Form.Label className="mb-1 text-muted small fw-semibold">Port</Form.Label>
                <AsyncPortSelect
                    isMulti
                    value={filters.port_objs}
                    onChange={v => setFilters(prev => ({...prev, port_objs: v}))}
                />
            </Form.Group>
        </Col>

        <Col xs={12} sm={6} md={4}>
            <Form.Group className="mb-0">
                <Form.Label className="mb-1 text-muted small fw-semibold">Exclude Port</Form.Label>
                <AsyncPortSelect
                    isMulti
                    placeholder="Exclude Port"
                    value={filters.exclude_port_objs}
                    onChange={v => setFilters(prev => ({...prev, exclude_port_objs: v}))}
                />
            </Form.Group>
        </Col>

        <Col xs={12} sm={6} md={4}>
            <Form.Group className="mb-0">
                <Form.Label className="mb-1 text-muted small fw-semibold">Has Invoice?</Form.Label>
                <YesNoRadio
                    value={filters.is_invoice}
                    onChange={val => setFilters(prev => ({...prev, is_invoice: val}))}
                />
            </Form.Group>
        </Col>

        <Col xs={12} sm={6} md={4}>
            <Form.Group className="mb-0">
                <Form.Label className="mb-1 text-muted small fw-semibold">From Date</Form.Label>
                <Form.Control
                    size="sm"
                    type="date"
                    value={filters.from_date}
                    onChange={e => setFilters(prev => ({...prev, from_date: e.target.value}))}
                />
            </Form.Group>
        </Col>

        <Col xs={12} sm={6} md={4}>
            <Form.Group className="mb-0">
                <Form.Label className="mb-1 text-muted small fw-semibold">To Date</Form.Label>
                <Form.Control
                    size="sm"
                    type="date"
                    value={filters.to_date}
                    onChange={e => setFilters(prev => ({...prev, to_date: e.target.value}))}
                />
            </Form.Group>
        </Col>
    </Row>
);

export default BoeFilters;
