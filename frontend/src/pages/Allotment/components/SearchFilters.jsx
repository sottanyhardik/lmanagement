import React from "react";
import {Button, Col, Form, Row, Spinner} from "react-bootstrap";
import AsyncNormSelect from "../../../components/AsyncNormSelect";

const SearchFilters = ({
                           srFilters,
                           setFilter,
                           onSearch,
                           onClear,
                           loading,
                           count,
                           page,
                           setPage,
                           pageSize,
                           resultsLength,
                       }) => (
    <div className="border rounded p-2 mb-2 bg-light">
        <Row className="g-2 align-items-end">
            <Col md={2}>
                <Form.Label className="small mb-1">License No</Form.Label>
                <Form.Control
                    size="sm"
                    value={srFilters.license_number}
                    onChange={(e) => setFilter("license_number", e.target.value)}
                />
            </Col>
            <Col md={3}>
                <Form.Label className="small mb-1">SION Norm</Form.Label>
                <AsyncNormSelect
                    value={
                        srFilters.sion_norm_id
                            ? {id: srFilters.sion_norm_id, label: srFilters.sion_norm_label}
                            : null
                    }
                    onChange={(opt) => {
                        setFilter("sion_norm_id", opt?.id || opt?.value || "");
                        setFilter("sion_norm_label", opt?.label || opt?.norm_class || "");
                    }}
                    placeholder="Search SION norm…"
                />
            </Col>
            <Col md={3}>
                <Form.Label className="small mb-1">Description</Form.Label>
                <Form.Control
                    size="sm"
                    value={srFilters.description}
                    onChange={(e) => setFilter("description", e.target.value)}
                />
            </Col>
            <Col md={2}>
                <Form.Label className="small mb-1">HSN Code</Form.Label>
                <Form.Control
                    size="sm"
                    value={srFilters.hs_code}
                    onChange={(e) => setFilter("hs_code", e.target.value)}
                />
            </Col>
            <Col md={2}>
                <Form.Label className="small mb-1">Notification No</Form.Label>
                <Form.Control
                    size="sm"
                    value={srFilters.notification_number}
                    onChange={(e) => setFilter("notification_number", e.target.value)}
                />
            </Col>
            <Col md={1}>
                <Form.Label className="small mb-1">Expired</Form.Label>
                <Form.Select
                    size="sm"
                    value={srFilters.expired}
                    onChange={(e) => setFilter("expired", e.target.value)}
                >
                    <option value="any">Any</option>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                </Form.Select>
            </Col>
            <Col md={1}>
                <Form.Label className="small mb-1">Is Null</Form.Label>
                <Form.Select
                    size="sm"
                    value={srFilters.is_null}
                    onChange={(e) => setFilter("is_null", e.target.value)}
                >
                    <option value="any">Any</option>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                </Form.Select>
            </Col>
            <Col md={2}>
                <Form.Label className="small mb-1">Min Balance Qty</Form.Label>
                <Form.Control
                    size="sm"
                    type="number"
                    min="0"
                    value={srFilters.min_balance_qty}
                    onChange={(e) => setFilter("min_balance_qty", e.target.value)}
                />
            </Col>
            <Col md={2}>
                <Form.Label className="small mb-1">Min Balance CIF ($)</Form.Label>
                <Form.Control
                    size="sm"
                    type="number"
                    min="0"
                    value={srFilters.min_balance_cif}
                    onChange={(e) => setFilter("min_balance_cif", e.target.value)}
                />
            </Col>
            <Col md="auto" className="pt-3">
                <Button
                    size="sm"
                    onClick={() => {
                        setPage(1);
                        onSearch();
                    }}
                >
                    {loading ? (
                        <>
                            <Spinner size="sm"/> Searching…
                        </>
                    ) : (
                        "Search"
                    )}
                </Button>
                <Button size="sm" variant="outline-secondary" className="ms-2" onClick={onClear}>
                    Clear
                </Button>
            </Col>
            <Col className="small text-muted pt-3">
                {count ? `Showing ${resultsLength} of ${count}` : loading ? "" : "No results"}
            </Col>
            <Col md="auto" className="pt-3">
                <div className="d-flex gap-2">
                    <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        ◀ Prev
                    </Button>
                    <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={resultsLength < pageSize || loading}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next ▶
                    </Button>
                </div>
            </Col>
        </Row>
    </div>
);

export default SearchFilters;
