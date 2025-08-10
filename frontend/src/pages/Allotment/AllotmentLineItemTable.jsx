import React from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
// Reuse your BOE async SR selector. Adjust the path if different in your project.
import AsyncSrNumberSelect from '../../components/AsyncSrNumberSelect.jsx';

const AllotmentLineItemTable = ({
                                    items,
                                    errors = {},
                                    onItemChange,
                                    onAddRow,
                                    onRemoveRow,
                                }) => {
    return (
        <div className="border p-2 rounded">
            <h6>Allotment Item Details</h6>
            {items.map((item, index) => (
                <Row key={index} className="mb-2 align-items-end">
                    <Col md={5}>
                        <Form.Label>License Item (SR)</Form.Label>
                        <AsyncSrNumberSelect
                            value={item.sr_number}
                            onChange={(v) => onItemChange(index, 'sr_number', v)}
                            placeholder="Search by license no / serial / description"
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    minHeight: '32px',
                                    fontSize: '0.875rem',
                                    borderColor: errors[`item_${index}_sr`] ? 'red' : base.borderColor,
                                    boxShadow: errors[`item_${index}_sr`] ? '0 0 0 0.2rem rgba(255,0,0,0.25)' : base.boxShadow
                                }),
                            }}
                            name={`item_${index}_sr`}
                        />
                        {errors[`item_${index}_sr`] && (
                            <div className="text-danger small">{errors[`item_${index}_sr`]}</div>
                        )}
                    </Col>

                    <Col md={2}>
                        <Form.Label>Quantity</Form.Label>
                        <Form.Control
                            size="sm"
                            type="number"
                            value={item.qty}
                            name={`item_${index}_qty`}
                            isInvalid={!!errors[`item_${index}_qty`]}
                            onChange={(e) => onItemChange(index, 'qty', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors[`item_${index}_qty`]}
                        </Form.Control.Feedback>
                    </Col>

                    <Col md={2}>
                        <Form.Label>CIF (FC)</Form.Label>
                        <Form.Control
                            size="sm"
                            type="number"
                            value={item.cif_fc}
                            name={`item_${index}_cif_fc`}
                            isInvalid={!!errors[`item_${index}_fc`]}
                            onChange={(e) => onItemChange(index, 'cif_fc', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors[`item_${index}_fc`]}
                        </Form.Control.Feedback>
                    </Col>

                    <Col md={2}>
                        <Form.Label>CIF (INR)</Form.Label>
                        <Form.Control
                            size="sm"
                            type="number"
                            value={item.cif_inr}
                            name={`item_${index}_cif_inr`}
                            isInvalid={!!errors[`item_${index}_inr`]}
                            onChange={(e) => onItemChange(index, 'cif_inr', e.target.value)}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors[`item_${index}_inr`]}
                        </Form.Control.Feedback>
                    </Col>

                    <Col md={1} className="d-flex flex-column">
                        <Form.Label>BOE?</Form.Label>
                        <Form.Check
                            type="checkbox"
                            checked={!!item.is_boe}
                            onChange={(e) => onItemChange(index, 'is_boe', e.target.checked)}
                        />
                    </Col>

                    <Col md={12} className="d-flex align-items-end mt-2">
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onRemoveRow(index)}
                        >
                            Remove
                        </Button>
                    </Col>
                </Row>
            ))}

            <div className="mt-2">
                <Button variant="primary" size="sm" onClick={onAddRow}>
                    + Add Item
                </Button>
            </div>
        </div>
    );
};

export default AllotmentLineItemTable;
