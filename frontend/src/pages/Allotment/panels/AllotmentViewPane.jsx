// src/pages/Allotment/panels/AllotmentViewPane.jsx
import React, {useState} from "react";
import {Badge, Button, ButtonGroup, Col, Row, Table} from "react-bootstrap";
import axios from "../../../api/axiosInstance";

const fmt = (n) =>
    n == null || Number.isNaN(+n)
        ? "-"
        : Number(n).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});

const totals = (rows = []) =>
    rows.reduce(
        (a, r) => ({
            qty: a.qty + (+r.qty || 0),
            fc: a.fc + (+r.cif_fc || 0),
            inr: a.inr + (+r.cif_inr || 0),
        }),
        {qty: 0, fc: 0, inr: 0}
    );

function filenameFromDisposition(h) {
    if (!h) return null;
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(h);
    try {
        return decodeURIComponent(m?.[1] || m?.[2] || "");
    } catch {
        return m?.[1] || m?.[2] || null;
    }
}

const AllotmentViewPane = ({entry}) => {
    const t = totals(entry?.allotment_details || []);
    const id = entry?.id;
    const [downloading, setDownloading] = useState(false);

    const forceDownload = async (e) => {
        e?.stopPropagation?.(); // prevent parent card/accordion toggles
        if (!id || downloading) return;
        setDownloading(true);
        try {
            // Absolute API path so the SPA router doesn't hijack
            const res = await axios.get(`/api/allotments/${id}/download-pdf/`, {
                params: {download: 1},
                responseType: "blob",
            });

            const blob = new Blob([res.data], {
                type: res.headers["content-type"] || "application/pdf",
            });
            const url = URL.createObjectURL(blob);

            const disp = res.headers["content-disposition"];
            const fname =
                filenameFromDisposition(disp) ||
                `Allotment_${id}${entry?.invoice ? "_" + String(entry.invoice).replace(/\s+/g, "_") : ""}.pdf`;

            const a = document.createElement("a");
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            // Last resort: still use absolute path
            window.open(`/api/allotments/${id}/download-pdf/?download=1`, "_blank", "noopener,noreferrer");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <>
            <Row className="mb-3 small">
                <Col md={3}>
                    <strong>Required Qty:</strong> {fmt(entry?.required_quantity)}
                </Col>
                <Col md={3}>
                    <strong>Unit Value/Unit:</strong> {fmt(entry?.unit_value_per_unit)}
                </Col>
                <Col md={3}>
                    <strong>Required Value:</strong> {fmt(entry?.required_cif_fc)}
                </Col>
                <Col md={3} className="text-md-end mt-2 mt-md-0">
                    <ButtonGroup size="sm" aria-label="Allotment PDF actions">
                        <Button
                            variant="primary"
                            type="button"
                            onClick={forceDownload}
                            disabled={!id || downloading}
                        >
                            {downloading ? "Downloading…" : "Download PDF"}
                        </Button>
                    </ButtonGroup>
                </Col>
            </Row>

            <div className="mb-2 small d-flex flex-wrap align-items-center">
                <Badge bg={Number(entry?.balanced_quantity) > 0 ? "warning" : "success"} className="me-2">
                    Balance: {fmt(entry?.balanced_quantity)}
                </Badge>
                <Badge bg="info" className="me-2">
                    Allotted Qty: {fmt(entry?.alloted_quantity)}
                </Badge>
                <Badge bg="secondary">Allotted $: {fmt(entry?.allotted_value)}</Badge>
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
                        <td>
                            {d.license_number} | {d.license_date}
                        </td>
                        <td>{d.exporter_name}</td>
                        <td>
                            {d.port_name} ({d.port_code})
                        </td>
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
