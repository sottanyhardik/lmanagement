import React, {useMemo} from 'react';
import {Card} from 'react-bootstrap';
import {getLabel} from '../../../utils/getLabel';

const FilterChips = ({filters, setFilters, onClearAll}) => {
    const chips = useMemo(() => {
        const list = [];

        // Helpers
        const addArrayChips = (arr, prefix, labelPrefix, keyProp = 'id', fieldName) => {
            if (!arr?.length) return;
            arr.forEach((item, idx) => {
                const key = `${prefix}_${item?.[keyProp] ?? idx}`;
                const label = `${labelPrefix}: ${getLabel(item)}`;
                const onClear = () =>
                    setFilters(prev => ({
                        ...prev,
                        [fieldName]: prev[fieldName].filter(x => (x?.[keyProp] ?? x) !== (item?.[keyProp] ?? item)),
                    }));
                list.push({key, label, onClear});
            });
        };

        addArrayChips(filters.company_objs, 'company', 'Company', 'id', 'company_objs');
        addArrayChips(filters.exclude_company_objs, 'ex_company', 'Exclude Company', 'id', 'exclude_company_objs');
        addArrayChips(filters.port_objs, 'port', 'Port', 'id', 'port_objs');
        addArrayChips(filters.exclude_port_objs, 'ex_port', 'Exclude Port', 'id', 'exclude_port_objs');

        if (filters.product_name) {
            list.push({
                key: 'product_name',
                label: `Product: ${filters.product_name}`,
                onClear: () => setFilters(prev => ({...prev, product_name: ''})),
            });
        }

        if (filters.from_date) {
            list.push({
                key: 'from_date',
                label: `From: ${filters.from_date}`,
                onClear: () => setFilters(prev => ({...prev, from_date: ''})),
            });
        }

        if (filters.to_date) {
            list.push({
                key: 'to_date',
                label: `To: ${filters.to_date}`,
                onClear: () => setFilters(prev => ({...prev, to_date: ''})),
            });
        }

        if (typeof filters.is_invoice === 'boolean') {
            list.push({
                key: 'is_invoice',
                label: `Invoiced: ${filters.is_invoice ? 'Yes' : 'No'}`,
                onClear: () => setFilters(prev => ({...prev, is_invoice: null})),
            });
        }

        return list;
    }, [filters, setFilters]);

    if (!chips.length) return null;

    return (
        <Card className="mb-3">
            <Card.Body className="py-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                    {chips.map(chip => (
                        <span key={chip.key} className="badge bg-light text-dark d-inline-flex align-items-center">
              {chip.label}
                            <button
                                type="button"
                                className="btn-close btn-close-white ms-2"
                                aria-label="Clear"
                                onClick={chip.onClear}
                                style={{filter: 'invert(1) grayscale(100%)'}}
                            />
            </span>
                    ))}
                    <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={onClearAll}
                            title="Clear all filters">
                        Clear All
                    </button>
                </div>
            </Card.Body>
        </Card>
    );
};

export default FilterChips;
