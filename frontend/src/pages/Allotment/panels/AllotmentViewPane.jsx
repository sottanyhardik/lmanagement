import React from 'react';
import {Badge, Col, Row, Table} from 'react-bootstrap';

const fmt = (n) => (n == null || Number.isNaN(+n) ? '-' :
    Number(n).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}));

const totals = (rows = []) => rows.reduce(
    (a, r) => ({qty: a.qty + (+r.qty || 0), fc: a.fc + (+r.cif_fc || 0), inr: a.inr + (+r.cif_inr || 0)}),
    {qty: 0, fc: 0, inr: 0}
);

const AllotmentViewPane = ({entry}) => {
    const t = totals(entry?.allotment_details || []);
    return (
        <>
            <Row className="mb-3 small">
                <Col md={3}><strong>Required Qty:</strong> {fmt(entry?.required_quantity)}</Col>
                <Col md={3}><strong>Unit Value/Unit:</strong> {fmt(entry?.unit_value_per_unit)}</Col>
                <Col md={3}><strong>Required Value:</strong> {fmt(entry?.required_cif_fc)}</Col>
            </Row>

            <div className="mb-2 small">
                <Badge bg={Number(entry?.balanced_quantity) > 0 ? 'warning' : 'success'} className="me-2">
                    Balance: {fmt(entry?.balanced_quantity)}
                </Badge>
                <Badge bg="info" className="me-2">
                    Allotted Qty: {fmt(entry?.alloted_quantity)}
                </Badge>
                <Badge bg="secondary">
                    Allotted $: {fmt(entry?.allotted_value)}
                </Badge>
            </div>

            <Table striped bordered hover responsive size="sm" className="mt-2">
                <thead className="table-light">
                <tr>
                    <th>#</th>
                    <th>SR</th>
                    <th>Description</th>
                    <th>HS</th>
                    <th>Unit</th>
                    <th className="text-end">Qty</th>
                    <th className="text-end">CIF $</th>
                    <th className="text-end">CIF ₹</th>
                    <th>License</th>
                    <th>Exporter</th>
                    <th>Port</th>
                </tr>
                </thead>
                <tbody>
                {(entry?.allotment_details || []).map((d, i) => (
                    <tr key={d.id || i}>
                        <td>{i + 1}</td>
                        <td>{d.serial_number}</td>
                        <td>{d.description}</td>
                        <td>{d.hs_code}</td>
                        <td>{d.unit}</td>
                        <td className="text-end">{fmt(d.qty)}</td>
                        <td className="text-end">{fmt(d.cif_fc)}</td>
                        <td className="text-end">{fmt(d.cif_inr)}</td>
                        <td>{d.license_number} | {d.license_date}</td>
                        <td>{d.exporter_name}</td>
                        <td>{d.port_name} ({d.port_code})</td>
                    </tr>
                ))}
                </tbody>
                <tfoot>
                <tr className="table-light fw-bold">
                    <td colSpan={5}>Total</td>
                    <td className="text-end">{fmt(t.qty)}</td>
                    <td className="text-end">{fmt(t.fc)}</td>
                    <td className="text-end">{fmt(t.inr)}</td>
                    <td colSpan={3}></td>
                </tr>
                </tfoot>
            </Table>
        </>
    );
};

export default AllotmentViewPane;
