import React, {useRef} from 'react';
import {Button, Col, Form, Row, Table} from 'react-bootstrap';
import AsyncHeadNormSelect from '../../components/AsyncSelect/AsyncHeadNormSelect';

const makeKey = () => {
    try {
        const bytes = new Uint8Array(8);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return Math.random().toString(36).slice(2, 10);
    }
};

const coerceNumber = (v) => (v === '' || v == null ? '' : Number(v));

/** Small helper to reduce repetition and keep error UI consistent */
const Cell = ({path, value, onChange, errors, type = 'text', ...rest}) => {
    const error =
        typeof errors?.get === 'function' ? errors.get(path) : errors?.[path] || '';

    return (
        <>
            <Form.Control
                size="sm"
                type={type}
                value={value}
                onChange={onChange}
                isInvalid={!!error}
                {...rest}
            />
            {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
        </>
    );
};

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
                      errors = {},
                      saving = false, // optional, if parent wants to disable submit while saving
                  }) => {
    const getError = (path) =>
        typeof errors.get === 'function' ? errors.get(path) : errors[path] || '';

    // Stable keys for rows using WeakMap (falls back to idx for absolute last resort)
    const exportKeyMapRef = useRef(new WeakMap());
    const importKeyMapRef = useRef(new WeakMap());

    const getRowKey = (row, idx, mapRef) => {
        if (row?.id != null) return `id-${row.id}`;
        if (row?._key != null) return `k-${row._key}`;
        const map = mapRef.current;
        const existing = map.get(row);
        if (existing) return existing;
        const k = `tmp-${makeKey()}`;
        map.set(row, k);
        return k;
    };

    const exportRows = normData?.export_norm ?? [];
    const importRows = normData?.import_norm ?? [];

    return (
        <Form>
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Norm Class</Form.Label>
                    <Cell
                        path="norm_class"
                        value={normData?.norm_class ?? ''}
                        onChange={(e) => onChange('norm_class', e.target.value)}
                        errors={errors}
                    />
                </Col>

                <Col md={4}>
                    <Form.Label>Description</Form.Label>
                    <Cell
                        path="description"
                        value={normData?.description ?? ''}
                        onChange={(e) => onChange('description', e.target.value)}
                        errors={errors}
                    />
                </Col>

                <Col md={4}>
                    <Form.Label>Head Norm</Form.Label>
                    <AsyncHeadNormSelect
                        value={normData?.head_norm_id_obj ?? null}
                        onChange={(selected) => {
                            onChange('head_norm_id', selected?.value || null);
                            onChange('head_norm_id_obj', selected || null);
                        }}
                        // pass-through niceties for menus inside modals, etc.
                        isClearable
                        menuPortalTarget={document.body}
                        styles={{menuPortal: (base) => ({...base, zIndex: 9999})}}
                        isInvalid={!!getError('head_norm_id')}
                    />
                    {getError('head_norm_id') && (
                        <div className="invalid-feedback d-block">{getError('head_norm_id')}</div>
                    )}
                </Col>
            </Row>

            {/* Export Norms */}
            <h6 className="text-uppercase text-success mt-3">Export Norm(s)</h6>
            <Table bordered size="sm" responsive>
                <caption className="visually-hidden">
                    Export norms for the selected head norm
                </caption>
                <thead>
                <tr>
                    <th>Description</th>
                    <th style={{width: 160}}>Quantity</th>
                    <th style={{width: 160}}>Unit</th>
                    <th style={{width: 120}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {exportRows.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="text-center text-muted">
                            No export rows yet.
                        </td>
                    </tr>
                ) : (
                    exportRows.map((row, idx) => {
                        const rowKey = getRowKey(row, idx, exportKeyMapRef);
                        return (
                            <tr key={rowKey}>
                                <td>
                                    <Cell
                                        path={`export_norm[${idx}].description`}
                                        value={row.description ?? ''}
                                        onChange={(e) => onExportChange(idx, 'description', e.target.value)}
                                        errors={errors}
                                    />
                                </td>
                                <td>
                                    <Cell
                                        path={`export_norm[${idx}].quantity`}
                                        type="number"
                                        value={row.quantity ?? ''}
                                        onChange={(e) =>
                                            onExportChange(idx, 'quantity', coerceNumber(e.target.value))
                                        }
                                        errors={errors}
                                        min="0"
                                        step="any"
                                        inputMode="decimal"
                                    />
                                </td>
                                <td>
                                    <Cell
                                        path={`export_norm[${idx}].unit`}
                                        value={row.unit ?? ''}
                                        onChange={(e) => onExportChange(idx, 'unit', e.target.value)}
                                        errors={errors}
                                    />
                                </td>
                                <td className="text-center">
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => onDeleteExportRow(idx)}
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        );
                    })
                )}
                </tbody>
            </Table>
            <Button size="sm" variant="outline-primary" onClick={onAddExportRow}>
                + Add Export Row
            </Button>

            {/* Import Norms */}
            <h6 className="text-uppercase text-success mt-4">Import Norm(s)</h6>
            <Table bordered size="sm" responsive>
                <caption className="visually-hidden">
                    Import norms for the selected head norm
                </caption>
                <thead>
                <tr>
                    <th>Description</th>
                    <th style={{width: 160}}>Quantity</th>
                    <th style={{width: 160}}>Unit</th>
                    <th>Condition</th>
                    <th style={{width: 120}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {importRows.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="text-center text-muted">
                            No import rows yet.
                        </td>
                    </tr>
                ) : (
                    importRows.map((row, idx) => {
                        const rowKey = getRowKey(row, idx, importKeyMapRef);
                        return (
                            <tr key={rowKey}>
                                <td>
                                    <Cell
                                        path={`import_norm[${idx}].description`}
                                        value={row.description ?? ''}
                                        onChange={(e) => onImportChange(idx, 'description', e.target.value)}
                                        errors={errors}
                                    />
                                </td>
                                <td>
                                    <Cell
                                        path={`import_norm[${idx}].quantity`}
                                        type="number"
                                        value={row.quantity ?? ''}
                                        onChange={(e) =>
                                            onImportChange(idx, 'quantity', coerceNumber(e.target.value))
                                        }
                                        errors={errors}
                                        min="0"
                                        step="any"
                                        inputMode="decimal"
                                    />
                                </td>
                                <td>
                                    <Cell
                                        path={`import_norm[${idx}].unit`}
                                        value={row.unit ?? ''}
                                        onChange={(e) => onImportChange(idx, 'unit', e.target.value)}
                                        errors={errors}
                                    />
                                </td>
                                <td>
                                    <Form.Control
                                        size="sm"
                                        value={row.condition ?? ''}
                                        onChange={(e) => onImportChange(idx, 'condition', e.target.value)}
                                    />
                                </td>
                                <td className="text-center">
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => onDeleteImportRow(idx)}
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        );
                    })
                )}
                </tbody>
            </Table>
            <Button size="sm" variant="outline-primary" onClick={onAddImportRow}>
                + Add Import Row
            </Button>

            {isNew && (
                <div className="mt-3">
                    <Button variant="success" size="sm" onClick={onSubmit} disabled={saving}>
                        {saving ? 'Saving…' : 'Submit'}
                    </Button>
                </div>
            )}
        </Form>
    );
};

export default NormForm;
