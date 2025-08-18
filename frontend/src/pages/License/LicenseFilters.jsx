// src/pages/License/LicenseFilters.jsx
import React from 'react';
import {Button, Form, InputGroup, ToggleButton, ToggleButtonGroup} from 'react-bootstrap';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect';

const LicenseFilters = ({filters, setFilters}) => {
    const set = (patch) => setFilters((prev) => ({...prev, ...patch}));

    return (
        <>
            <Form.Group className="mb-2">
                <Form.Label className="small mb-1">Exporter</Form.Label>
                <AsyncCompanySelect
                    isMulti
                    placeholder="Select exporter(s)…"
                    value={filters.exporter_objs}
                    onChange={(v) => set({exporter_objs: v})}
                />
            </Form.Group>

            <Form.Group className="mb-2">
                <Form.Label className="small mb-1">Port</Form.Label>
                <AsyncPortSelect
                    isMulti
                    placeholder="Select port(s)…"
                    value={filters.port_objs}
                    onChange={(v) => set({port_objs: v})}
                />
            </Form.Group>

            <Form.Group className="mb-2">
                <Form.Label className="small mb-1">License Number</Form.Label>
                <Form.Control
                    size="sm"
                    placeholder="e.g. 12345"
                    value={filters.license_number || ''}
                    onChange={(e) => set({license_number: e.target.value})}
                />
            </Form.Group>

            <Form.Group className="mb-2">
                <Form.Label className="small mb-1">From Date</Form.Label>
                <Form.Control
                    size="sm"
                    type="date"
                    value={filters.from_date || ''}
                    onChange={(e) => set({from_date: e.target.value})}
                />
            </Form.Group>

            <Form.Group className="mb-2">
                <Form.Label className="small mb-1">To Date</Form.Label>
                <Form.Control
                    size="sm"
                    type="date"
                    value={filters.to_date || ''}
                    onChange={(e) => set({to_date: e.target.value})}
                />
            </Form.Group>

            <Form.Group className="mb-2">
                <Form.Label className="small mb-1">Balance (CIF)</Form.Label>
                <InputGroup size="sm">
                    <ToggleButtonGroup
                        type="radio"
                        name="balance_cmp"
                        value={filters.balance_cmp ?? 'gte'}
                        onChange={(val) => set({balance_cmp: val})}
                    >
                        <ToggleButton id="cmp-gte" value="gte" variant="outline-secondary">≥</ToggleButton>
                        <ToggleButton id="cmp-lte" value="lte" variant="outline-secondary">≤</ToggleButton>
                    </ToggleButtonGroup>

                    <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="100"
                        value={filters.balance_val ?? ''}
                        onChange={(e) => set({balance_val: e.target.value})}
                        aria-label="Balance threshold"
                    />

                    {!!(filters.balance_val ?? '') && (
                        <Button
                            variant="outline-secondary"
                            onClick={() => set({balance_val: '', balance_cmp: 'gte'})}
                        >
                            Clear
                        </Button>
                    )}
                </InputGroup>
            </Form.Group>
        </>
    );
};

export default LicenseFilters;