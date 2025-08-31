// src/components/generic/FilterChips.jsx
import React, {useMemo} from "react";
import {Badge, Button} from "react-bootstrap";

/**
 * Auto chip rules:
 * - Arrays named *_objs: expects array of { id, name/label }.
 * - Strings: shows if non-empty.
 * - Dates (keys ending in _date, or from_date/to_date): shows if non-empty.
 * - Booleans: shows as Yes/No if key starts with is_ or has_ / include_.
 *
 * Optional `definitions` lets you override:
 *  {
 *    product_name: { label: "Product", format: v => v, remove: (filters,set) => {...} },
 *    company_objs: { label: "Company", getItems: arr => arr.map(x=>({id:x.id,label:x.name})), removeItem: (id, filters,set)=>{...} }
 *  }
 */
const FilterChips = ({filters = {}, setFilters, onClearAll, definitions = {}}) => {
    const chips = useMemo(() => {
        const out = [];

        const pushSimple = (key, label, value, remover) => {
            if (!value) return;
            out.push({key, label, text: String(value), onRemove: remover});
        };

        const pushBool = (key, label, value, remover) => {
            if (typeof value !== "boolean") return;
            out.push({key, label, text: value ? "Yes" : "No", onRemove: remover});
        };

        const entries = Object.entries(filters || {});
        for (const [key, value] of entries) {
            const def = definitions[key];

            // Arrays like *_objs
            if (Array.isArray(value)) {
                const items = def?.getItems
                    ? def.getItems(value)
                    : value.map((x) => ({
                        id: x?.id ?? x?.value ?? x,
                        label: x?.name ?? x?.display_name ?? x?.label ?? String(x),
                    }));

                items.forEach((it) => {
                    out.push({
                        key: `${key}:${it.id}`,
                        label: def?.label || key.replace(/_objs$/, "").replace(/_/g, " "),
                        text: it.label,
                        onRemove: () => {
                            const next = (filters[key] || []).filter(
                                (x) => (x?.id ?? x?.value ?? x) !== it.id
                            );
                            setFilters?.((prev) => ({...prev, [key]: next}));
                        },
                    });
                });
                continue;
            }

            // Booleans
            if (typeof value === "boolean") {
                pushBool(
                    key,
                    def?.label || key.replace(/_/g, " "),
                    value,
                    () => setFilters?.((prev) => ({...prev, [key]: null}))
                );
                continue;
            }

            // Dates
            if (
                /date$/i.test(key) ||
                key === "from_date" ||
                key === "to_date" ||
                key === "date_from" ||
                key === "date_to"
            ) {
                pushSimple(
                    key,
                    def?.label || key.replace(/_/g, " "),
                    value,
                    () => setFilters?.((prev) => ({...prev, [key]: ""}))
                );
                continue;
            }

            // Strings / numbers
            if (value != null && value !== "") {
                pushSimple(
                    key,
                    def?.label || key.replace(/_/g, " "),
                    def?.format ? def.format(value) : value,
                    () => setFilters?.((prev) => ({...prev, [key]: ""}))
                );
            }
        }
        return out;
    }, [filters, setFilters, definitions]);

    if (!chips.length && !onClearAll) return null;

    return (
        <div className="d-flex flex-wrap gap-2 mb-2">
            {chips.map((c) => (
                <Badge
                    key={c.key}
                    bg="light"
                    text="dark"
                    className="d-flex align-items-center gap-2 border"
                    style={{fontWeight: 400}}
                >
                    <span className="text-muted">{c.label}:</span> {c.text}
                    <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={c.onRemove}
                        className="py-0 px-1 ms-1"
                    >
                        ×
                    </Button>
                </Badge>
            ))}
            {onClearAll && (
                <Button size="sm" variant="outline-dark" onClick={onClearAll}>
                    Clear All
                </Button>
            )}
        </div>
    );
};

export default FilterChips;
