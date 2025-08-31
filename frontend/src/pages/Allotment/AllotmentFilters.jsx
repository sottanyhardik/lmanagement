// src/pages/Allotment/AllotmentFilters.jsx
import React from "react";
import {Col, Form, Row} from "react-bootstrap";
import AsyncCompanySelect from "../../components/AsyncSelect/AsyncCompanySelect";
import AsyncPortSelect from "../../components/AsyncSelect/AsyncPortSelect";
import YesNoRadio from "../../components/YesNoRadio";

const AllotmentFilters = ({filters, setFilters}) => (
    <Row className="g-2 g-md-3 align-items-end">
        {/* Row 1 */}
        <Col md={4}>
            <Form.Label className="mb-1">Company (Include)</Form.Label>
            <AsyncCompanySelect
                isMulti
                value={filters.company_objs}
                onChange={(v) => setFilters((p) => ({...p, company_objs: v || []}))}
                placeholder="Select company(s)"
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">Company (Exclude)</Form.Label>
            <AsyncCompanySelect
                isMulti
                value={filters.exclude_company_objs}
                onChange={(v) => setFilters((p) => ({...p, exclude_company_objs: v || []}))}
                placeholder="Exclude company(s)"
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">Related Company</Form.Label>
            <AsyncCompanySelect
                value={filters.related_company}
                onChange={(v) => setFilters((p) => ({...p, related_company: v}))}
                placeholder="Related company"
            />
        </Col>

        {/* Row 2 */}
        <Col md={4}>
            <Form.Label className="mb-1">Port (Include)</Form.Label>
            <AsyncPortSelect
                isMulti
                value={filters.port_objs}
                onChange={(v) => setFilters((p) => ({...p, port_objs: v || []}))}
                placeholder="Select port(s)"
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">Port (Exclude)</Form.Label>
            <AsyncPortSelect
                isMulti
                value={filters.exclude_port_objs}
                onChange={(v) => setFilters((p) => ({...p, exclude_port_objs: v || []}))}
                placeholder="Exclude port(s)"
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">Exporter</Form.Label>
            <AsyncCompanySelect
                value={filters.exporter}
                onChange={(v) => setFilters((p) => ({...p, exporter: v}))}
                placeholder="Exporter"
            />
        </Col>

        {/* Row 3 */}
        <Col md={4}>
            <Form.Label className="mb-1">Invoice</Form.Label>
            <Form.Control
                size="sm"
                placeholder="Invoice number"
                value={filters.invoice || ""}
                onChange={(e) => setFilters((p) => ({...p, invoice: e.target.value}))}
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">Item Name</Form.Label>
            <Form.Control
                size="sm"
                placeholder="Item / product"
                value={filters.item_name || ""}
                onChange={(e) => setFilters((p) => ({...p, item_name: e.target.value}))}
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">License Number</Form.Label>
            <Form.Control
                size="sm"
                placeholder="License #"
                value={filters.license_number || ""}
                onChange={(e) => setFilters((p) => ({...p, license_number: e.target.value}))}
            />
        </Col>

        {/* Row 4 */}
        <Col md={4}>
            <Form.Label className="mb-1">HS Code</Form.Label>
            <Form.Control
                size="sm"
                placeholder="HS Code"
                value={filters.hs_code || ""}
                onChange={(e) => setFilters((p) => ({...p, hs_code: e.target.value}))}
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">From Date</Form.Label>
            <Form.Control
                size="sm"
                type="date"
                value={filters.date_from || ""}
                onChange={(e) => setFilters((p) => ({...p, date_from: e.target.value}))}
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">To Date</Form.Label>
            <Form.Control
                size="sm"
                type="date"
                value={filters.date_to || ""}
                onChange={(e) => setFilters((p) => ({...p, date_to: e.target.value}))}
            />
        </Col>

        {/* Row 5 */}
        <Col md={4}>
            <Form.Label className="mb-1">Has Balance?</Form.Label>
            <YesNoRadio
                value={filters.has_balance}
                onChange={(val) => setFilters((p) => ({...p, has_balance: val}))}
            />
        </Col>
        <Col md={4}>
            <Form.Label className="mb-1">Show All With BOE?</Form.Label>
            <YesNoRadio
                value={filters.include_assigned}
                onChange={(val) => setFilters((p) => ({...p, include_assigned: val}))}
            />
        </Col>
    </Row>
);

export default AllotmentFilters;
