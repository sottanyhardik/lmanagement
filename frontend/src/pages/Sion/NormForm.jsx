import React from 'react';
import {Button, Col, Form, Row, Table} from 'react-bootstrap';
import AsyncHeadNormSelect from '../../components/AsyncSelect/AsyncHeadNormSelect.jsx';

const NormForm = ({
                      normData,
                      onChange,
                      onImportChange,
                      onAddImportRow,
                      onDeleteImportRow,
                      onExportChange,
                      onAddExportRow,
                      onDeleteExportRow,
                      onSubmit,
                      isNew = false,
                      errors = {}
                  }) => {
    const getError = (path) =>
        typeof errors.get === 'function' ? errors.get(path) : (errors[path] || '');

    return (
        <Form>
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Norm Class</Form.Label>
                    <Form.Control
                        size="sm"
                        value={normData.norm_class}
                        isInvalid={!!getError('norm_class')}
                        onChange={(e) => onChange('norm_class', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">
                        {getError('norm_class')}
                    </Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                        size="sm"
                        value={normData.description}
                        isInvalid={!!getError('description')}
                        onChange={(e) => onChange('description', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">
                        {getError('description')}
                    </Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Head Norm</Form.Label>
                    <AsyncHeadNormSelect
                        value={normData.head_norm_id_obj}
                        onChange={(selected) => {
                            onChange('head_norm_id', selected?.value || null);
                            onChange('head_norm_id_obj', selected || null);
                        }}
                        isInvalid={!!getError('head_norm_id')}
                    />
                    {getError('head_norm_id') && (
                        <div className="invalid-feedback d-block">
                            {getError('head_norm_id')}
                        </div>
                    )}
                </Col>
            </Row>

            <h6 className="text-uppercase text-success mt-3">Export Norm(s)</h6>
            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {normData.export_norm.map((row, idx) => (
                    <tr key={idx}>
                        <td>
                            <Form.Control
                                size="sm"
                                value={row.description}
                                isInvalid={!!getError(`export_norm[${idx}].description`)}
                                onChange={(e) =>
                                    onExportChange(idx, 'description', e.target.value)
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {getError(`export_norm[${idx}].description`)}
                            </Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control
                                size="sm"
                                type="number"
                                value={row.quantity}
                                isInvalid={!!getError(`export_norm[${idx}].quantity`)}
                                onChange={(e) =>
                                    onExportChange(idx, 'quantity', e.target.value)
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {getError(`export_norm[${idx}].quantity`)}
                            </Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control
                                size="sm"
                                value={row.unit}
                                isInvalid={!!getError(`export_norm[${idx}].unit`)}
                                onChange={(e) =>
                                    onExportChange(idx, 'unit', e.target.value)
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {getError(`export_norm[${idx}].unit`)}
                            </Form.Control.Feedback>
                        </td>
                        <td>
                            <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => onDeleteExportRow(idx)}
                            >
                                Delete
                            </Button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>
            <Button size="sm" variant="outline-primary" onClick={onAddExportRow}>
                + Add Export Row
            </Button>

            <h6 className="text-uppercase text-success mt-4">Import Norm(s)</h6>
            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Condition</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {normData.import_norm.map((row, idx) => (
                    <tr key={idx}>
                        <td>
                            <Form.Control
                                size="sm"
                                value={row.description}
                                isInvalid={!!getError(`import_norm[${idx}].description`)}
                                onChange={(e) =>
                                    onImportChange(idx, 'description', e.target.value)
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {getError(`import_norm[${idx}].description`)}
                            </Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control
                                size="sm"
                                type="number"
                                value={row.quantity}
                                isInvalid={!!getError(`import_norm[${idx}].quantity`)}
                                onChange={(e) =>
                                    onImportChange(idx, 'quantity', e.target.value)
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {getError(`import_norm[${idx}].quantity`)}
                            </Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control
                                size="sm"
                                value={row.unit}
                                isInvalid={!!getError(`import_norm[${idx}].unit`)}
                                onChange={(e) =>
                                    onImportChange(idx, 'unit', e.target.value)
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {getError(`import_norm[${idx}].unit`)}
                            </Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control
                                size="sm"
                                value={row.condition}
                                onChange={(e) =>
                                    onImportChange(idx, 'condition', e.target.value)
                                }
                            />
                        </td>
                        <td>
                            <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => onDeleteImportRow(idx)}
                            >
                                Delete
                            </Button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>
            <Button size="sm" variant="outline-primary" onClick={onAddImportRow}>
                + Add Import Row
            </Button>

            {isNew && (
                <div className="mt-3">
                    <Button variant="success" size="sm" onClick={onSubmit}>
                        Submit
                    </Button>
                </div>
            )}
        </Form>
    );
};

export default NormForm;
