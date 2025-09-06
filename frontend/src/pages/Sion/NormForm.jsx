// src/pages/SionNorms/NormForm.jsx
import React, {useEffect, useMemo, useState} from "react";
import {Button, Form, Table} from "react-bootstrap";
import AsyncHSCodeSelect from "../../components/AsyncSelect/AsyncHSCodeSelect";
import axios from "../../api/axiosInstance";
import {toast} from "react-toastify";

/* ---------- helpers ---------- */
const deepClone = (v) => JSON.parse(JSON.stringify(v ?? null));

const emptyExport = () => ({id: undefined, description: "", quantity: "", unit: "kg"});
const emptyImport = () => ({
    id: undefined,
    sr_no: "",
    description: "",
    quantity: "",
    unit: "kg",
    condition: "",
    hsn_code: null,     // react-select option {value,label,data}
    hsn_code_id: null,  // pk for backend
});

/** try to extract a numeric id from various option shapes */
const getHSId = (opt) => {
    if (!opt) return null;
    // common shapes we may see
    return (
        opt.value ??
        opt.id ??
        opt?.data?.id ??
        null
    );
};

/** row emptiness checks (so we don't send phantom rows) */
const isEmptyExport = (r) => {
    const desc = (r?.description ?? "").trim();
    const qty = String(r?.quantity ?? "").trim();
    return desc === "" && (qty === "" || Number(qty) === 0);
};
const isEmptyImport = (r) => {
    const desc = (r?.description ?? "").trim();
    const qty = String(r?.quantity ?? "").trim();
    const sr = String(r?.sr_no ?? "").trim();
    const hasHS = r?.hsn_code_id != null && r?.hsn_code_id !== "";
    return desc === "" && (qty === "" || Number(qty) === 0) && sr === "" && !hasHS;
};

export default function NormForm({norm, onSaved, onClose}) {
    /** normalize incoming prop (prefill) */
    const normalizedFromProp = useMemo(() => {
        const n = deepClone(norm) || {};
        const exp = Array.isArray(n.export_norm) ? n.export_norm : [];
        const imp = Array.isArray(n.import_norm) ? n.import_norm : [];

        return {
            id: n.id ?? undefined,
            norm_class: n.norm_class ?? "",
            description: n.description ?? "",
            head_norm_id: n.head_norm?.id ?? null,

            export_norm: exp.length
                ? exp.map((e) => ({
                    id: e.id,
                    description: e.description ?? "",
                    quantity: e.quantity ?? "",
                    unit: e.unit ?? "kg",
                }))
                : [emptyExport()],

            import_norm: imp.length
                ? imp.map((r) => ({
                    id: r.id,
                    sr_no: r.sr_no ?? "",
                    description: r.description ?? "",
                    quantity: r.quantity ?? "",
                    unit: r.unit ?? "kg",
                    condition: r.condition ?? "",
                    // hsn_code may be null in API — keep UI object null but track id
                    hsn_code: r.hsn_code
                        ? {value: r.hsn_code.id, label: r.hsn_code.hs_code, data: r.hsn_code}
                        : null,
                    hsn_code_id: r.hsn_code?.id ?? null,
                }))
                : [emptyImport()],
        };
    }, [norm]);

    const [data, setData] = useState(normalizedFromProp);
    const [saving, setSaving] = useState(false);

    /** ensure prefill shows when `norm` arrives/changes */
    useEffect(() => {
        setData(normalizedFromProp);
    }, [normalizedFromProp]);

    const setField = (name, value) => setData((p) => ({...p, [name]: value}));

    /* ----- export rows ----- */
    const addExportRow = () =>
        setData((p) => ({...p, export_norm: [...p.export_norm, emptyExport()]}));
    const removeExportRow = (idx) =>
        setData((p) => ({...p, export_norm: p.export_norm.filter((_, i) => i !== idx)}));
    const updateExportCell = (idx, patch) =>
        setData((p) => {
            const arr = [...p.export_norm];
            arr[idx] = {...arr[idx], ...patch};
            return {...p, export_norm: arr};
        });

    /* ----- import rows ----- */
    const addImportRow = () =>
        setData((p) => ({...p, import_norm: [...p.import_norm, emptyImport()]}));
    const removeImportRow = (idx) =>
        setData((p) => ({...p, import_norm: p.import_norm.filter((_, i) => i !== idx)}));
    const updateImportCell = (idx, patch) =>
        setData((p) => {
            const arr = [...p.import_norm];
            arr[idx] = {...arr[idx], ...patch};
            return {...p, import_norm: arr};
        });

    /* ---------- build payload (no phantom rows; ids only when truthy) ---------- */
    const buildPayload = () => {
        const cleanedExports = (data.export_norm || [])
            .filter((e) => !isEmptyExport(e))
            .map((e) => {
                const out = {
                    description: (e.description ?? "").trim(),
                    quantity: (e.quantity ?? "") === "" ? "" : String(e.quantity),
                    unit: e.unit ?? "kg",
                };
                if (e.id) out.id = e.id; // send id only when truthy so backend updates instead of creating
                return out;
            });

        const cleanedImports = (data.import_norm || [])
            .filter((r) => !isEmptyImport(r))
            .map((r) => {
                const out = {
                    sr_no: (r.sr_no ?? "") === "" ? "" : String(r.sr_no),
                    description: (r.description ?? "").trim(),
                    quantity: (r.quantity ?? "") === "" ? "" : String(r.quantity),
                    unit: r.unit ?? "kg",
                    condition: (r.condition ?? "").trim(),
                    // robust HS id extraction (covers {value}, {id}, {data:{id}})
                    hsn_code_id:
                        r.hsn_code_id ??
                        getHSId(r.hsn_code) ??
                        null,
                };
                if (r.id) out.id = r.id;
                return out;
            });

        return {
            id: data.id,
            norm_class: data.norm_class,
            description: data.description,
            head_norm_id: data.head_norm_id,
            export_norm: cleanedExports,
            import_norm: cleanedImports,
        };
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = buildPayload();
            const res = data.id
                ? await axios.patch(`sion-classes/${data.id}/`, payload)
                : await axios.post(`sion-classes/`, payload);
            toast.success(data.id ? "Norm updated" : "Norm created");
            onSaved?.(res.data);
        } catch (err) {
            console.error(err?.response?.data || err);
            toast.error("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    /* ---------- UI ---------- */
    return (
        <>
            <Form.Group className="mb-2">
                <Form.Label>Norm Class</Form.Label>
                <Form.Control
                    value={data.norm_class}
                    onChange={(e) => setField("norm_class", e.target.value)}
                    disabled={saving}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                    value={data.description}
                    onChange={(e) => setField("description", e.target.value)}
                    disabled={saving}
                />
            </Form.Group>

            {/* Export norms */}
            <h6 className="mt-2">Export Norm</h6>
            <Table bordered size="sm" className="align-middle">
                <thead>
                <tr>
                    <th style={{width: "50%"}}>Description</th>
                    <th style={{width: "20%"}} className="text-end">Quantity</th>
                    <th style={{width: "15%"}}>Unit</th>
                    <th style={{width: "15%"}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {(data.export_norm || []).map((row, i) => (
                    <tr key={`ex-${i}`}>
                        <td>
                            <Form.Control
                                value={row.description || ""}
                                onChange={(e) => updateExportCell(i, {description: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td>
                            <Form.Control
                                type="number"
                                step="0.001"
                                className="text-end"
                                value={row.quantity ?? ""}
                                onChange={(e) => updateExportCell(i, {quantity: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={row.unit || "kg"}
                                onChange={(e) => updateExportCell(i, {unit: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td className="text-nowrap">
                            {/* ✅ correct remover */}
                            <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => removeExportRow(i)}
                                disabled={saving}
                            >
                                Remove
                            </Button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>
            <Button size="sm" variant="outline-primary" onClick={addExportRow} disabled={saving}>
                + Add Export Row
            </Button>

            {/* Import norms */}
            <h6 className="mt-4">Import Norm</h6>
            <Table bordered size="sm" className="align-middle">
                <thead>
                <tr>
                    <th style={{width: "7%"}}>Sr No</th>
                    <th style={{width: "24%"}}>Description</th>
                    <th style={{width: "18%"}}>HSN / HS Code</th>
                    <th style={{width: "13%"}} className="text-end">Quantity</th>
                    <th style={{width: "10%"}}>Unit</th>
                    <th style={{width: "18%"}}>Condition</th>
                    <th style={{width: "10%"}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {(data.import_norm || []).map((row, i) => (
                    <tr key={`im-${i}`}>
                        <td>
                            <Form.Control
                                type="number"
                                value={row.sr_no ?? ""}
                                onChange={(e) => updateImportCell(i, {sr_no: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={row.description || ""}
                                onChange={(e) => updateImportCell(i, {description: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td>
                            <AsyncHSCodeSelect
                                value={row.hsn_code}
                                onChange={(opt) =>
                                    updateImportCell(i, {
                                        hsn_code: opt,
                                        hsn_code_id: getHSId(opt), // ← robust id extraction
                                    })
                                }
                                defaultOptions
                                isDisabled={saving}
                                placeholder="Select HS Code"
                            />
                        </td>
                        <td>
                            <Form.Control
                                type="number"
                                step="0.001"
                                className="text-end"
                                value={row.quantity ?? ""}
                                onChange={(e) => updateImportCell(i, {quantity: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={row.unit || "kg"}
                                onChange={(e) => updateImportCell(i, {unit: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td>
                            <Form.Control
                                value={row.condition || ""}
                                onChange={(e) => updateImportCell(i, {condition: e.target.value})}
                                disabled={saving}
                            />
                        </td>
                        <td className="text-nowrap">
                            <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => removeImportRow(i)}
                                disabled={saving}
                            >
                                Remove
                            </Button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>
            <Button size="sm" variant="outline-primary" onClick={addImportRow} disabled={saving}>
                + Add Import Row
            </Button>

            <div className="mt-3">
                <Button size="sm" variant="success" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save Norm"}
                </Button>
                {onClose && (
                    <Button
                        size="sm"
                        variant="secondary"
                        className="ms-2"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                )}
            </div>
        </>
    );
}
