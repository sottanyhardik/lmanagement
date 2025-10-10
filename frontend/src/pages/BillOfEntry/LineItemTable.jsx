// src/pages/BOE/LineItemTable.jsx
import React from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
import AsyncSrNumberSelect from '../../components/AsyncSelect/AsyncSrNumberSelect';

const LineItemTable = ({
                           items,
                           errors = {},
                           selectedSrNumbers = [],
                           onItemChange,
                           onAddRow,
                           onRemoveRow,
                           lastRowRef,
                       }) => {
    return (
        <div className="border p-2 rounded">
            <h6>Item Details</h6>

            {items.map((item, index) => {
                const errSr = errors[`item_${index}_sr`];
                const errQty = errors[`item_${index}_qty`];
                const errFc = errors[`item_${index}_fc`];
                const errInr = errors[`item_${index}_inr`];

                // Exclude SRs already selected in other rows.
                const excludeIds = selectedSrNumbers.filter((id) => {
                    const thisId =
                        item?.sr_number?.value ?? item?.sr_number?.id ?? null;
                    return id && id !== thisId;
                });

                return (
                    <Row key={index} className="mb-2 align-items-end">
                        <Col md={4}>
                            <Form.Label>License (SR) Number</Form.Label>
                            <AsyncSrNumberSelect
                                value={item.sr_number || null}
                                onChange={(v) => onItemChange(index, 'sr_number', v)}
                                excludeIds={excludeIds}
                                placeholder="Select SR"
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        minHeight: '32px',
                                        fontSize: '0.875rem',
                                        borderColor: errSr ? 'red' : base.borderColor,
                                        boxShadow: errSr
                                            ? '0 0 0 0.2rem rgba(255,0,0,0.25)'
                                            : base.boxShadow,
                                    }),
                                }}
                                name={`item_${index}_sr`}
                                ref={index === items.length - 1 ? lastRowRef : undefined}
                            />
                            {errSr && (
                                <div className="text-danger small">{errSr}</div>
                            )}
                        </Col>

                        <Col md={2}>
                            <Form.Label>Quantity</Form.Label>
                            <Form.Control
                                size="sm"
                                type="number"
                                step="0.0001"
                                min="0"
                                value={item.qty ?? ''}
                                name={`item_${index}_qty`}
                                isInvalid={!!errQty}
                                onChange={(e) => onItemChange(index, 'qty', e.target.value)}
                            />
                            <Form.Control.Feedback type="invalid">
                                {errQty}
                            </Form.Control.Feedback>
                        </Col>

                        <Col md={2}>
                            <Form.Label>CIF (FC)</Form.Label>
                            <Form.Control
                                size="sm"
                                type="number"
                                step="0.0001"
                                min="0"
                                value={item.cif_fc ?? ''}
                                name={`item_${index}_cif_fc`}
                                isInvalid={!!errFc}
                                onChange={(e) => onItemChange(index, 'cif_fc', e.target.value)}
                            />
                            <Form.Control.Feedback type="invalid">
                                {errFc}
                            </Form.Control.Feedback>
                        </Col>

                        <Col md={2}>
                            <Form.Label>CIF (INR)</Form.Label>
                            <Form.Control
                                size="sm"
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.cif_inr ?? ''}
                                name={`item_${index}_cif_inr`}
                                isInvalid={!!errInr}
                                onChange={(e) => onItemChange(index, 'cif_inr', e.target.value)}
                            />
                            <Form.Control.Feedback type="invalid">
                                {errInr}
                            </Form.Control.Feedback>
                        </Col>

                        <Col md={2} className="d-flex align-items-end">
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => onRemoveRow(index)}
                            >
                                Remove
                            </Button>
                        </Col>
                    </Row>
                );
            })}

            <div className="mt-2">
                <Button variant="primary" size="sm" onClick={onAddRow}>
                    + Add Item
                </Button>
            </div>
        </div>
    );
};

export default LineItemTable;
