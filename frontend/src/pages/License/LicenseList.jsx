import React from 'react';
import {Badge, Card, Table} from 'react-bootstrap';
import dayjs from 'dayjs';

const LicenseList = ({licenses}) => {
    const formatNumber = (val) =>
        val != null ? Number(val).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-';

    const calcExportTotals = (items) => {
        return items.reduce((acc, item) => ({
            cif_fc: acc.cif_fc + (parseFloat(item.cif_fc) || 0),
            cif_inr: acc.cif_inr + (parseFloat(item.cif_inr) || 0),
        }), {cif_fc: 0, cif_inr: 0});
    };

    const calcImportTotals = (items) => {
        return items.reduce((acc, item) => ({
            cif_fc: acc.cif_fc + (parseFloat(item.cif_fc) || 0),
            cif_inr: acc.cif_inr + (parseFloat(item.cif_inr) || 0),
            debited_value: acc.debited_value + (parseFloat(item.debited_value) || 0),
            allotted_value: acc.allotted_value + (parseFloat(item.allotted_value) || 0),
        }), {cif_fc: 0, cif_inr: 0, debited_value: 0, allotted_value: 0});
    };

    return (
        <>
            {licenses.map((lic) => {
                const exportTotals = calcExportTotals(lic.export_items || []);
                const importTotals = calcImportTotals(lic.import_items || []);

                return (
                    <Card className="mb-4 shadow-sm" key={lic.id}>
                        <Card.Header className="bg-primary text-white d-flex justify-content-between">
                            <div>
                                <strong>License #{lic.license_number}</strong> —
                                Date: {dayjs(lic.license_date).format('YYYY-MM-DD')} |
                                Expiry: {dayjs(lic.license_expiry_date).format('YYYY-MM-DD')}
                            </div>
                            <div>
                                Balance CIF: ₹<Badge bg="light" text="dark">{formatNumber(lic.balance_cif)}</Badge>
                            </div>
                        </Card.Header>

                        <Card.Body className="bg-light">
                            {/* Export Section */}
                            <h6 className="text-success mb-2">Export Items</h6>
                            <Table striped bordered hover responsive size="sm">
                                <thead className="table-success">
                                <tr>
                                    <th>#</th>
                                    <th>Description</th>
                                    <th>Norm Class</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>CIF FC</th>
                                    <th>CIF INR</th>
                                </tr>
                                </thead>
                                <tbody>
                                {lic.export_items.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td>{idx + 1}</td>
                                        <td>{item.description || '-'}</td>
                                        <td>{item.norm_class_name || '-'}</td>
                                        <td className="text-end">{formatNumber(item.net_quantity)}</td>
                                        <td>{item.unit}</td>
                                        <td className="text-end">{formatNumber(item.cif_fc)}</td>
                                        <td className="text-end">{formatNumber(item.cif_inr)}</td>
                                    </tr>
                                ))}
                                </tbody>
                                <tfoot>
                                <tr className="table-success fw-bold">
                                    <td colSpan={2}>Total</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="text-end">{formatNumber(exportTotals.cif_fc)}</td>
                                    <td className="text-end">{formatNumber(exportTotals.cif_inr)}</td>
                                </tr>
                                </tfoot>
                            </Table>

                            {/* Import Section */}
                            <h6 className="text-primary mt-4 mb-2">Import Items</h6>
                            <Table striped bordered hover responsive size="sm">
                                <thead className="table-primary">
                                <tr>
                                    <th>#</th>
                                    <th>Description</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>CIF FC</th>
                                    <th>CIF INR</th>
                                    <th>Alloted Qty</th>
                                    <th>Alloted Value</th>
                                    <th>Debited Qty</th>
                                    <th>Debited Value</th>
                                    <th>Balance Qty</th>
                                </tr>
                                </thead>
                                <tbody>
                                {lic.import_items.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td>{idx + 1}</td>
                                        <td>{item.description}</td>
                                        <td className="text-end">{formatNumber(item.quantity)}</td>
                                        <td>{item.unit}</td>
                                        <td className="text-end">{formatNumber(item.cif_fc)}</td>
                                        <td className="text-end">{formatNumber(item.cif_inr)}</td>
                                        <td className="text-end">{formatNumber(item.allotted_quantity)}</td>
                                        <td className="text-end">{formatNumber(item.allotted_value)}</td>
                                        <td className="text-end">{formatNumber(item.debited_quantity)}</td>
                                        <td className="text-end">{formatNumber(item.debited_value)}</td>
                                        <td className="text-end">{formatNumber(item.available_quantity)}</td>
                                    </tr>
                                ))}
                                </tbody>
                                <tfoot>
                                <tr className="table-primary fw-bold">
                                    <td colSpan={4}>Total</td>
                                    <td className="text-end">{formatNumber(importTotals.cif_fc)}</td>
                                    <td className="text-end">{formatNumber(importTotals.cif_inr)}</td>
                                    <td></td>
                                    <td className="text-end">{formatNumber(importTotals.allotted_value)}</td>
                                    <td></td>
                                    <td className="text-end">{formatNumber(importTotals.debited_value)}</td>
                                    <td></td>
                                </tr>
                                </tfoot>
                            </Table>
                        </Card.Body>
                    </Card>
                );
            })}
        </>
    );
};

export default LicenseList;
