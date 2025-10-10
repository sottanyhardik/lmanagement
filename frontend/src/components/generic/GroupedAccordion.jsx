// src/components/generic/GroupedAccordion.jsx
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Accordion, Badge, Card, Collapse, Form} from "react-bootstrap";

/** ---------- small helpers ---------- */
const toPairs = (obj) =>
    Object.entries(obj || {}).map(([label, node]) => ({label, ...node}));

const fmt2 = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0.00";
    return v.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

/** Compute totals from an entries array using common fields */
const sumEntries = (entries = []) =>
    entries.reduce(
        (acc, e) => {
            acc.qty += Number(e?.quantity ?? e?.balance_quantity ?? e?.total_quantity ?? e?.required_quantity ?? 0) || 0;
            acc.fc += Number(e?.cif_fc ?? e?.balance_cif_fc ?? 0) || 0;
            acc.inr += Number(e?.cif_inr ?? e?.balance_cif_inr ?? 0) || 0;
            return acc;
        },
        {qty: 0, fc: 0, inr: 0}
    );

/** Render a totals line based on requested fields */
const TotalsLine = ({totals, fields = ["qty", "fc", "inr"]}) => {
    const chips = [];
    const push = (label, value, variant) =>
        chips.push(
            <span key={label} className="me-2">
        {label}: <Badge bg={variant}>{fmt2(value)}</Badge>
      </span>
        );

    for (const f of fields) {
        if (f === "qty") push("Qty", totals.qty, "primary");
        if (f === "fc") push("CIF $", totals.fc, "info");
        if (f === "inr") push("INR ₹", totals.inr, "success");
    }

    return <div className="text-muted small">{chips}</div>;
};

/** ---------- normalize groups to a common consumable array ---------- */
const normalizeGroups = (groups) => {
    if (!groups) return [];

    // If already array, try to detect shape
    if (Array.isArray(groups)) {
        return groups.map((g) => {
            const out = {label: g.label ?? g.company ?? g.exporter ?? g.name ?? "—"};
            if (Array.isArray(g.items)) {
                out.items = g.items.map((it) => ({
                    label: it.label ?? it.item ?? it.name ?? "—",
                    ports: Array.isArray(it.ports)
                        ? it.ports.map((p) => ({
                            label: p.label ?? p.port ?? p.name ?? "—",
                            entries: Array.isArray(p.entries) ? p.entries : [],
                            summary: p.summary,
                        }))
                        : toPairs(it.ports).map((p) => ({
                            label: p.label,
                            entries: Array.isArray(p.entries) ? p.entries : [],
                            summary: p.summary,
                        })),
                }));
            } else if (g.items && typeof g.items === "object") {
                out.items = toPairs(g.items).map((it) => ({
                    label: it.label,
                    ports: Array.isArray(it.ports)
                        ? it.ports
                        : toPairs(it.ports).map((p) => ({
                            label: p.label,
                            entries: Array.isArray(p.entries) ? p.entries : [],
                            summary: p.summary,
                        })),
                }));
            }

            // 2-level direct ports
            if (!out.items && (Array.isArray(g.ports) || typeof g.ports === "object")) {
                out.ports = Array.isArray(g.ports)
                    ? g.ports.map((p) => ({
                        label: p.label ?? p.port ?? p.name ?? "—",
                        entries: Array.isArray(p.entries) ? p.entries : [],
                        summary: p.summary,
                    }))
                    : toPairs(g.ports).map((p) => ({
                        label: p.label,
                        entries: Array.isArray(p.entries) ? p.entries : [],
                        summary: p.summary,
                    }));
            }
            return out;
        });
    }

    // Object map
    return toPairs(groups).map((c) => {
        const out = {label: c.label};
        if (c.items) {
            out.items = Array.isArray(c.items) ? c.items : toPairs(c.items);
            out.items = out.items.map((it) => ({
                label: it.label ?? it.item ?? it.name ?? "—",
                ports: Array.isArray(it.ports)
                    ? it.ports
                    : toPairs(it.ports).map((p) => ({
                        label: p.label,
                        entries: Array.isArray(p.entries) ? p.entries : [],
                        summary: p.summary,
                    })),
            }));
        } else if (c.ports) {
            out.ports = Array.isArray(c.ports)
                ? c.ports.map((p) => ({
                    label: p.label ?? p.port ?? p.name ?? "—",
                    entries: Array.isArray(p.entries) ? p.entries : [],
                    summary: p.summary,
                }))
                : toPairs(c.ports).map((p) => ({
                    label: p.label,
                    entries: Array.isArray(p.entries) ? p.entries : [],
                    summary: p.summary,
                }));
        }
        return out;
    });
};

/** ---------- default headers if you don't pass custom renderers ---------- */
const DefaultCompanyHeader = ({company, fields}) => {
    const ports = company.items ? company.items.flatMap((it) => it.ports || []) : company.ports || [];
    const entries = ports.flatMap((p) => p.entries || []);
    const s = sumEntries(entries);

    return (
        <div className="w-100">
            <div className="fw-bold fs-6 text-primary">🏢 {company.label}</div>
            <div className="ms-2">
                <TotalsLine totals={s} fields={fields}/>
            </div>
        </div>
    );
};

const DefaultItemHeader = ({item}) => (
    <div className="fw-semibold text-info">📦 {item.label}</div>
);

const DefaultPortHeader = ({port, count, fields}) => {
    const s = port.summary || sumEntries(port.entries || []);
    return (
        <div className="d-flex align-items-center justify-content-between w-100">
            <div className="fw-semibold">
                🛳 {port.label} <span className="text-muted small ms-2">({count} item{count > 1 ? "s" : ""})</span>
            </div>
            <TotalsLine totals={s} fields={fields}/>
        </div>
    );
};

/** ----- Tri-state Select All with quick actions ----- */
const PortSelectAll = ({entries = [], selection}) => {
    const {selectedIds = [], toggleSelectAll, toggleSelect} = selection || {};
    if (!Array.isArray(selectedIds) || typeof toggleSelectAll !== "function") return null;

    const ids = entries.map((e) => e?.id).filter((x) => x != null);
    const total = ids.length;
    const selectedCount = ids.filter((id) => selectedIds.includes(id)).length;
    const allSel = total > 0 && selectedCount === total;
    const someSel = selectedCount > 0 && selectedCount < total;

    const cbRef = useRef(null);
    useEffect(() => {
        if (cbRef.current) cbRef.current.indeterminate = someSel && !allSel;
    }, [someSel, allSel]);

    const handleToggle = () => {
        // if all selected -> clear; else -> select all
        toggleSelectAll(ids);
    };

    const handleNone = () => {
        if (allSel) {
            toggleSelectAll(ids); // toggles all off
        } else if (someSel && typeof toggleSelect === "function") {
            ids.forEach((id) => {
                if (selectedIds.includes(id)) toggleSelect(id);
            });
        }
    };

    return (
        <div className="d-flex align-items-center gap-2">
            <Form.Check
                ref={cbRef}
                type="checkbox"
                label="Select all"
                className="small"
                checked={allSel}
                onChange={handleToggle}
            />
            <span className="text-muted small">{selectedCount} / {total} selected</span>
            {/* Optional quick none/all actions: */}
            {/* <Button size="sm" variant="link" className="p-0" onClick={handleNone}>None</Button> */}
        </div>
    );
};

/**
 * Build a full expanded map for the provided `groups`.
 * Use this from your page to implement "Expand All / Collapse All".
 */
export const buildExpandedMap = (groups, expand = true) => {
    const map = {};
    const safeStr = (x) => (x == null ? "" : String(x));

    const visitCompanyArray = (arr) => {
        (arr || []).forEach((company, ci) => {
            const items = company.items || null;
            if (items && items.length) {
                items.forEach((it, ii) => {
                    (it.ports || []).forEach((port, pi) => {
                        (port.entries || []).forEach((e, ei) => {
                            const key = e?.id != null ? String(e.id) : `${safeStr(company.label)}|${safeStr(it.label)}|${safeStr(port.label)}|${ci}:${ii}:${pi}:${ei}`;
                            map[key] = !!expand;
                        });
                    });
                });
            } else {
                (company.ports || []).forEach((port, pi) => {
                    (port.entries || []).forEach((e, ei) => {
                        const key = e?.id != null ? String(e.id) : `${safeStr(company.label)}|${safeStr(port.label)}|${ci}:${pi}:${ei}`;
                        map[key] = !!expand;
                    });
                });
            }
        });
    };

    if (Array.isArray(groups)) visitCompanyArray(groups);
    else visitCompanyArray(normalizeGroups(groups));

    return map;
};

/**
 * If `expanded` and `toggle` are provided, this component is **controlled**.
 * Otherwise, it manages local expansion and only reads `allExpanded` to seed initial state.
 */
export default function GroupedAccordion({
                                             groups,
                                             allExpanded = false, // affects uncontrolled initial seed only

                                             // Controlled expansion (optional). If omitted, uses internal state.
                                             expanded,
                                             toggle,

                                             // Selection (either bundle or separate props)
                                             selection,
                                             selectedIds,
                                             toggleSelect,
                                             toggleSelectAll,

                                             // Custom renderers (optional)
                                             renderCompanyHeader,
                                             renderItemHeader,
                                             renderPortHeader,
                                             renderEntryCard,

                                             // Totals fields per level (override for License pages)
                                             companyTotals = ["qty", "fc", "inr"],
                                             portTotals = ["qty", "fc", "inr"],

                                             emptyText = "No entries.",
                                         }) {
    const companies = useMemo(() => normalizeGroups(groups), [groups]);

    // ----- selection normalization -----
    const sel = {
        selectedIds: selection?.selectedIds ?? selectedIds ?? [],
        toggleSelect: selection?.toggleSelect ?? toggleSelect,
        toggleSelectAll: selection?.toggleSelectAll ?? toggleSelectAll,
    };
    const haveSelection =
        Array.isArray(sel.selectedIds) &&
        (typeof sel.toggleSelectAll === "function" || typeof sel.toggleSelect === "function");

    // ----- controlled vs uncontrolled entry expansion -----
    const isControlled = typeof expanded === "object" && typeof toggle === "function";
    const [localExpanded, setLocalExpanded] = useState({});
    const expandedMap = isControlled ? expanded : localExpanded;
    const doToggle = isControlled
        ? (key) => toggle(key)
        : (key) => setLocalExpanded((prev) => ({...prev, [key]: !prev[key]}));

    // Seed local expansion when groups change or allExpanded flips (uncontrolled only)
    useEffect(() => {
        if (isControlled) return;
        const next = buildExpandedMap(companies, allExpanded);
        setLocalExpanded(next);
    }, [companies, allExpanded, isControlled]);

    // Company accordion keys (open all by default)
    const [openCompanies, setOpenCompanies] = useState([]);
    useEffect(() => {
        setOpenCompanies(companies.map((_, i) => `cmp-${i}`));
    }, [companies]);

    const handleCompanyToggle = (ek) => {
        if (ek == null) return;
        setOpenCompanies((prev) => (prev.includes(ek) ? prev.filter((k) => k !== ek) : [...prev, ek]));
    };

    const entryKeyOf = (entry, fallback) => (entry?.id != null ? String(entry.id) : String(fallback));

    return (
        <Accordion alwaysOpen activeKey={openCompanies} onSelect={handleCompanyToggle}>
            {companies.map((company, cIdx) => (
                <Accordion.Item key={`${company.label}-${cIdx}`} eventKey={`cmp-${cIdx}`}
                                className="border border-primary mb-3">
                    <Accordion.Header className="bg-light text-primary">
                        {renderCompanyHeader ? (
                            renderCompanyHeader({company})
                        ) : (
                            <DefaultCompanyHeader company={company} fields={companyTotals}/>
                        )}
                    </Accordion.Header>

                    <Accordion.Body className="bg-white">
                        {/* If items exist, render 3-level. Otherwise render ports directly (2-level). */}
                        {company.items && company.items.length > 0 ? (
                            company.items.map((item, iIdx) => (
                                <div key={`${company.label}-${item.label}-${iIdx}`}
                                     className="mb-4 p-3 border rounded bg-light-subtle">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        {renderItemHeader ? renderItemHeader({item, company}) :
                                            <DefaultItemHeader item={item}/>}
                                    </div>

                                    {(item.ports || []).map((port, pIdx) => {
                                        const entries = Array.isArray(port.entries) ? port.entries : [];
                                        return (
                                            <div key={`${company.label}-${item.label}-${port.label}-${pIdx}`}
                                                 className="mb-4">
                                                <div
                                                    className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                                                    {renderPortHeader ? (
                                                        renderPortHeader({port, item, company, count: entries.length})
                                                    ) : (
                                                        <DefaultPortHeader port={port} count={entries.length}
                                                                           fields={portTotals}/>
                                                    )}
                                                    {haveSelection &&
                                                        <PortSelectAll entries={entries} selection={sel}/>}
                                                </div>

                                                {entries.length === 0 &&
                                                    <div className="text-muted small">{emptyText}</div>}

                                                {entries.map((entry, eIdx) => {
                                                    const entryKey = entryKeyOf(entry, `${cIdx}:${iIdx}:${pIdx}:${eIdx}`);
                                                    const isOpen = !!expandedMap[entryKey];
                                                    const toggleEntry = () => doToggle(entryKey);

                                                    return renderEntryCard ? (
                                                        <React.Fragment key={entryKey}>
                                                            {renderEntryCard({
                                                                entry,
                                                                expanded: expandedMap,
                                                                toggleEntry,
                                                                selection: haveSelection ? sel : null,
                                                            })}
                                                        </React.Fragment>
                                                    ) : (
                                                        <Card key={entryKey}
                                                              className="mb-3 shadow-sm border border-secondary">
                                                            <Card.Header onClick={toggleEntry}
                                                                         style={{cursor: "pointer"}}>
                                                                <div className="small text-muted">Entry
                                                                    #{entryKey}</div>
                                                            </Card.Header>
                                                            <Collapse in={isOpen} mountOnEnter unmountOnExit>
                                                                <Card.Body>
                                                                    Provide <code>renderEntryCard</code> to render
                                                                    details.
                                                                </Card.Body>
                                                            </Collapse>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        ) : (
                            // 2-level: company -> ports
                            <>
                                {(company.ports || []).length === 0 &&
                                    <div className="text-muted small">{emptyText}</div>}

                                {(company.ports || []).map((port, pIdx) => {
                                    const entries = Array.isArray(port.entries) ? port.entries : [];
                                    return (
                                        <div key={`${company.label}-${port.label}-${pIdx}`}
                                             className="mb-4 p-3 border rounded bg-light-subtle">
                                            <div
                                                className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                                                {renderPortHeader ? (
                                                    renderPortHeader({port, company, count: entries.length})
                                                ) : (
                                                    <DefaultPortHeader port={port} count={entries.length}
                                                                       fields={portTotals}/>
                                                )}
                                                {haveSelection && <PortSelectAll entries={entries} selection={sel}/>}
                                            </div>

                                            {entries.length === 0 &&
                                                <div className="text-muted small">{emptyText}</div>}

                                            {entries.map((entry, eIdx) => {
                                                const entryKey = entryKeyOf(entry, `${cIdx}:${pIdx}:${eIdx}`);
                                                const isOpen = !!expandedMap[entryKey];
                                                const toggleEntry = () => doToggle(entryKey);

                                                return renderEntryCard ? (
                                                    <React.Fragment key={entryKey}>
                                                        {renderEntryCard({
                                                            entry,
                                                            expanded: expandedMap,
                                                            toggleEntry,
                                                            selection: haveSelection ? sel : null,
                                                        })}
                                                    </React.Fragment>
                                                ) : (
                                                    <Card key={entryKey}
                                                          className="mb-3 shadow-sm border border-secondary">
                                                        <Card.Header onClick={toggleEntry} style={{cursor: "pointer"}}>
                                                            <div className="small text-muted">Entry #{entryKey}</div>
                                                        </Card.Header>
                                                        <Collapse in={isOpen} mountOnEnter unmountOnExit>
                                                            <Card.Body>
                                                                Provide <code>renderEntryCard</code> to render details.
                                                            </Card.Body>
                                                        </Collapse>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </Accordion.Body>
                </Accordion.Item>
            ))}
        </Accordion>
    );
}
