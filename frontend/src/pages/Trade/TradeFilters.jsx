import React from "react";
import {Col, Form, Row} from "react-bootstrap";
import AsyncCompanySelect from "../../components/AsyncSelect/AsyncCompanySelect";
import AsyncBOESelect from "../../components/AsyncSelect/AsyncBOESelect";

const TradeFilters = ({filters, setFilters}) => {
    const set = (patch) => setFilters((prev) => ({...prev, ...patch}));
    const isPurchase = filters.direction === "PURCHASE";

    return (
        <>
            <Row className="g-2">
                <Col xs={12} md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label className="small mb-1">Direction</Form.Label>
                        <Form.Select
                            size="sm"
                            value={filters.direction || ""}
                            onChange={(e) => set({direction: e.target.value || null, ...(e.target.value === "PURCHASE" ? {boe_obj: null} : {})})}
                        >
                            <option value="">All</option>
                            <option value="PURCHASE">Purchase</option>
                            <option value="SALE">Sale</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
                <Col xs={12} md={5}>
                    <Form.Group className="mb-2">
                        <Form.Label className="small mb-1">Company (either side)</Form.Label>
                        <AsyncCompanySelect
                            isMulti
                            placeholder="Select company…"
                            value={filters.company_objs}
                            onChange={(v) => set({company_objs: v})}
                            classNamePrefix="async-select"
                        />
                    </Form.Group>
                </Col>

                {/* Hide BOE when filtering for Purchase */}
                {!isPurchase && (
                    <Col xs={12} md={4}>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">BOE</Form.Label>
                            <AsyncBOESelect
                                placeholder="Search BOE…"
                                value={filters.boe_obj || null}
                                onChange={(v) => set({boe_obj: v})}
                                classNamePrefix="async-select"
                            />
                        </Form.Group>
                    </Col>
                )}
            </Row>

            <Row className="g-2">
                <Col xs={12} md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label className="small mb-1">Invoice #</Form.Label>
                        <Form.Control
                            size="sm"
                            placeholder="e.g. INV-1001"
                            value={filters.invoice_number || ""}
                            onChange={(e) => set({invoice_number: e.target.value})}
                        />
                    </Form.Group>
                </Col>
                <Col xs={12} md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label className="small mb-1">From Date</Form.Label>
                        <Form.Control
                            size="sm"
                            type="date"
                            value={filters.date_from || ""}
                            onChange={(e) => set({date_from: e.target.value})}
                        />
                    </Form.Group>
                </Col>
                <Col xs={12} md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label className="small mb-1">To Date</Form.Label>
                        <Form.Control
                            size="sm"
                            type="date"
                            value={filters.date_to || ""}
                            onChange={(e) => set({date_to: e.target.value})}
                        />
                    </Form.Group>
                </Col>
                <Col xs={12} md={3}>
                    <Form.Group className="mb-2">
                        <Form.Label className="small mb-1">Has Due</Form.Label>
                        <Form.Select
                            size="sm"
                            value={String(filters.has_due ?? "")}
                            onChange={(e) =>
                                set({has_due: e.target.value === "" ? null : e.target.value === "true"})
                            }
                        >
                            <option value="">All</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
        </>
    );
};

export default TradeFilters;
