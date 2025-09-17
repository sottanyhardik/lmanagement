import React, {useEffect, useMemo, useState} from 'react';
import {Button, Col, Form, Row, Spinner, Table} from 'react-bootstrap';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import {fetchTransferLetterTemplates} from '../../Cache/templateCache';

/**
 * Props:
 * - allotment: Allotment object (must include company + allotment_details)
 * - autoDownload: boolean (open the generated file automatically)
 * - generatePath: (a) => string   // allows API flexibility
 * - onGenerated: (payload, response) => void
 */
const TransferLetterFromAllotment = ({
                                         allotment,
                                         autoDownload = false,
                                         generatePath = (a) => `allotments/${a?.id}/transfer-letter/`,
                                         onGenerated,
                                     }) => {
    const [templates, setTemplates] = useState([]);
    const [tplLoading, setTplLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [form, setForm] = useState({
        company: '',
        company_address_line1: '',
        company_address_line2: '',
        tl_choice: '',
    });

    const [rows, setRows] = useState([]);

    // ---------- helpers ----------
    const setField = (k, v) => setForm((s) => ({...s, [k]: v}));

    const toNumber = (v) => {
        const n = typeof v === 'string' ? v.replace(/,/g, '') : v;
        const x = Number(n);
        return Number.isFinite(x) ? x : 0;
    };

    const downloadFromResponse = (res, fallback = 'transfer_letter.docx') => {
        // prefer JSON with {url}
        if (res?.data?.url) {
            const a = document.createElement('a');
            a.href = res.data.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.click();
            return true;
        }
        // or blob content
        const ct = res?.headers?.['content-type'] || '';
        if (ct && (ct.includes('application') || ct.includes('octet-stream'))) {
            const blob = new Blob([res.data], {type: ct});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fallback;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            return true;
        }
        return false;
    };

    // ---------- load templates once ----------
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await fetchTransferLetterTemplates();
                if (!alive) return;
                const list = Array.isArray(data) ? data : [];
                setTemplates(list);
                // preselect sole template
                if (list.length === 1) {
                    setField('tl_choice', String(list[0].id));
                }
            } catch {
                toast.error('Failed to load transfer letter templates');
            } finally {
                if (alive) setTplLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // ---------- populate from Allotment ----------
    useEffect(() => {
        if (!allotment) return;

        setForm((s) => ({
            ...s,
            company: allotment?.company?.name || '',
            company_address_line1: allotment?.company?.address_line_1 || '',
            company_address_line2: allotment?.company?.address_line_2 || '',
            // keep tl_choice as-is (user might have selected already)
        }));

        const mapped =
            allotment?.allotment_details?.map((d, idx) => {
                const srText =
                    d?.item?.display_name ??
                    d?.item_label ??
                    d?.sr_number?.display_name ??
                    (d?.license_number && d?.serial_number
                        ? `LIC ${d.license_number} • SR ${d.serial_number}`
                        : `SR ${idx + 1}`);

                return {
                    id: d.id ?? idx,
                    sr_number: srText,
                    cif_fc: toNumber(d?.cif_fc),
                };
            }) ?? [];

        setRows(mapped);
    }, [allotment]);

    const tplOptions = useMemo(
        () =>
            templates.map((t) => ({
                value: String(t.id),
                label: t.name ?? `Template #${t.id}`,
            })),
        [templates]
    );

    const handleRowCif = (i, val) => {
        setRows((prev) =>
            prev.map((r, idx) => (idx === i ? {...r, cif_fc: toNumber(val)} : r))
        );
    };

    const handleGenerate = async () => {
        if (!allotment?.id) {
            toast.error('Missing Allotment context.');
            return;
        }
        if (!form.tl_choice) {
            toast.warning('Please select a transfer letter template.');
            return;
        }

        const payload = {
            company: form.company?.trim() || '',
            company_address_line1: form.company_address_line1?.trim() || '',
            company_address_line2: form.company_address_line2?.trim() || '',
            tl_choice: form.tl_choice,
            modified_items: rows.map((r) => ({
                id: r.id,
                cif_fc: toNumber(r.cif_fc),
            })),
        };

        setGenerating(true);
        try {
            // Try JSON first; if your API returns a file, we’ll retry as blob.
            const url = generatePath(allotment);
            let res;
            try {
                res = await axios.post(url, payload);
            } catch {
                // fallback: maybe API returns a file
                res = await axios.post(url, payload, {responseType: 'blob'});
            }

            toast.success('Transfer Letter generated.');
            onGenerated?.(payload, res);

            if (autoDownload) {
                const ok = downloadFromResponse(res);
                if (!ok) toast.info('Generated. Download link not provided by server.');
            }
        } catch (err) {
            console.error(err);
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.error ||
                'Failed to generate Transfer Letter';
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    // ---------- render ----------
    if (tplLoading) {
        return (
            <div className="text-muted">
                <Spinner size="sm" className="me-2"/> Loading templates…
            </div>
        );
    }

    return (
        <Form className="border p-3 rounded bg-light">
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Company</Form.Label>
                    <Form.Control
                        value={form.company}
                        onChange={(e) => setField('company', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 1</Form.Label>
                    <Form.Control
                        value={form.company_address_line1}
                        onChange={(e) => setField('company_address_line1', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 2</Form.Label>
                    <Form.Control
                        value={form.company_address_line2}
                        onChange={(e) => setField('company_address_line2', e.target.value)}
                    />
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Label>Template</Form.Label>
                    <Form.Select
                        value={form.tl_choice}
                        onChange={(e) => setField('tl_choice', e.target.value)}
                    >
                        <option value="">— Select Transfer Letter Template —</option>
                        {tplOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </Form.Select>
                </Col>
            </Row>

            <h6 className="mt-3 mb-2">Edit CIF (FC) per SR</h6>
            <Table bordered size="sm" responsive className="mb-3">
                <thead className="table-light">
                <tr>
                    <th style={{width: 60}}>#</th>
                    <th>SR Number</th>
                    <th className="text-end" style={{width: 200}}>
                        CIF FC (editable)
                    </th>
                </tr>
                </thead>
                <tbody>
                {rows.map((r, i) => (
                    <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.sr_number}</td>
                        <td className="text-end">
                            <Form.Control
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={Number.isFinite(r.cif_fc) ? r.cif_fc : ''}
                                onChange={(e) => handleRowCif(i, e.target.value)}
                                style={{textAlign: 'right'}}
                            />
                        </td>
                    </tr>
                ))}
                {!rows.length && (
                    <tr>
                        <td colSpan={3} className="text-center text-muted">
                            No items to include.
                        </td>
                    </tr>
                )}
                </tbody>
            </Table>

            <div className="text-end">
                <Button onClick={handleGenerate} disabled={generating || !allotment}>
                    {generating ? 'Generating…' : 'Generate Transfer Letter'}
                </Button>
            </div>
        </Form>
    );
};

export default TransferLetterFromAllotment;
