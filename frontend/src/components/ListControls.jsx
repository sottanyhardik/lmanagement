// src/components/ListControls.jsx
// Title top-left, search top-right, labeled filters in a compact flex-wrap grid
// Actions bar below the filters. No Row/Col, no placeholders.

import React, {Children, isValidElement, useEffect, useMemo, useState} from 'react';
import {
    Badge,
    Button,
    Collapse,
    Dropdown,
    Form,
    InputGroup,
    OverlayTrigger,
    SplitButton,
    Tooltip,
} from 'react-bootstrap';
import {FaFileExport, FaFilter, FaPlus, FaSearch, FaTimes} from 'react-icons/fa';

const ListControls = ({
                          title = 'List',
                          onlyHeader = true,

                          // Search
                          search = '',
                          setSearch,
                          setPage,

                          // Sort
                          sortField,
                          sortOrder,
                          setSortField,
                          setSortOrder,
                          sortOptions = [
                              {label: 'Modified On ⬇️', value: 'modified_on:desc'},
                              {label: 'Modified On ⬆️', value: 'modified_on:asc'},
                          ],

                          // Selection
                          selectedIds = [],
                          onDeleteSelected,

                          // Add button(s)
                          onAddNew,         // legacy
                          onAddNewClick,    // preferred
                          showAdd = true,

                          // Filters
                          // Accepts:
                          //   - React nodes (existing usage). Label auto-derived from node.props.label/placeholder.
                          //   - Objects: { label: string, element: ReactNode }
                          Filters = [],
                          filtersTitle = 'Filters',
                          filtersCollapsible = true,
                          defaultFiltersOpen = true,

                          // Resets / exports
                          handleReset,
                          handleExportCSV,
                          handleExportPDF,

                          // Layout tuning
                          sticky = false,
                      }) => {
    // Title
    useEffect(() => {
        document.title = String(title || '').toUpperCase();
    }, [title]);

    // Debounced search with guard
    const [query, setQuery] = useState(search || '');
    useEffect(() => {
        if (search !== undefined && search !== query) setQuery(search || '');
    }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const t = setTimeout(() => {
            if (setPage) setPage(1);
            if (typeof setSearch === 'function' && query !== (search || '')) {
                setSearch(query);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sort
    const sortValue = useMemo(
        () => (sortField && sortOrder ? `${sortField}:${sortOrder}` : ':'),
        [sortField, sortOrder]
    );
    const handleSortChange = (e) => {
        const [field, order] = e.target.value.split(':');
        setSortField?.(field || undefined);
        setSortOrder?.(order || undefined);
        setPage?.(1);
    };

    const AddHandler = onAddNewClick || onAddNew;
    const hasExports = Boolean(handleExportCSV || handleExportPDF);
    const showBulkDelete = selectedIds.length > 0 && onDeleteSelected;

    const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);

    // Normalize Filters -> array of { label, element }
    const FilterItems = useMemo(() => {
        const normalizeOne = (item) => {
            // If dev passes { label, element }
            if (item && typeof item === 'object' && 'element' in item) {
                return {
                    label: item.label ?? '',
                    element: item.element,
                };
            }
            // If it's a React element, try to infer a label
            if (isValidElement(item)) {
                const labelGuess =
                    item.props?.label ??
                    item.props?.placeholder ??
                    (typeof item.props?.name === 'string' ? item.props.name.replace(/[_-]/g, ' ') : '') ??
                    '';
                return {label: labelGuess, element: item};
            }
            return null;
        };

        let nodes = [];
        if (Array.isArray(Filters)) {
            nodes = Filters;
        } else if (Filters && Filters.props && Filters.props.children) {
            nodes = Children.toArray(Filters.props.children);
        } else if (Filters) {
            nodes = [Filters];
        }

        return nodes.map(normalizeOne).filter(Boolean);
    }, [Filters]);

    return (
        <div className="mb-3">
            {/* Header: title left, search right */}
            <div
                className={
                    'd-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 ' +
                    (sticky ? ' position-sticky top-0 bg-body z-3 pt-2 pb-2' : '')
                }
                style={sticky ? {borderBottom: '1px solid var(--bs-border-color-translucent)'} : undefined}
            >
                <div className="d-flex align-items-center">
                    <h2 className="fw-semibold text-primary mb-0">{title}</h2>
                    {showBulkDelete && (
                        <Badge bg="danger" className="ms-2" title={`${selectedIds.length} selected`}>
                            {selectedIds.length}
                        </Badge>
                    )}
                </div>

                {onlyHeader && (
                    <div className="d-flex align-items-center gap-2 w-100 w-md-auto">
                        <InputGroup size="sm" className="ms-md-auto" style={{minWidth: 260}}>
                            <InputGroup.Text className="bg-white">
                                <FaSearch aria-hidden/>
                            </InputGroup.Text>
                            <Form.Control
                                placeholder="Search…"
                                aria-label="Search list"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            {query ? (
                                <Button variant="outline-secondary" onClick={() => setQuery('')}>
                                    <FaTimes aria-label="Clear search"/>
                                </Button>
                            ) : null}
                        </InputGroup>

                        {FilterItems.length > 0 && (
                            <Button
                                size="sm"
                                variant={filtersOpen ? 'outline-dark' : 'outline-secondary'}
                                onClick={() => setFiltersOpen((s) => !s)}
                            >
                                <FaFilter className="me-1"/> {filtersTitle}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Sort row */}
            <div className="d-flex justify-content-end mt-2 mb-2 gap-2">
                <Form.Select
                    size="sm"
                    style={{minWidth: 220}}
                    aria-label="Sort by"
                    value={sortValue}
                    onChange={handleSortChange}
                >
                    <option value=":">Sort By</option>
                    {sortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </Form.Select>
            </div>

            {/* Filters area: labeled, compact; FLEX-WRAP (no Row/Col, no placeholders) */}
            {FilterItems.length > 0 && (
                <Collapse in={!filtersCollapsible || filtersOpen}>
                    <div className="bg-white border rounded-3 p-3 mb-3 shadow-sm">
                        <div
                            className="d-flex flex-wrap"
                            style={{
                                gap: '0.5rem 0.75rem',         // row gap, col gap
                            }}
                        >
                            {FilterItems.map(({label, element}, idx) => (
                                <div
                                    key={`f-${idx}`}
                                    className="filter-item"
                                    style={{
                                        flex: '1 1 320px',         // grows, minimum width ~320px
                                        maxWidth: '100%',          // prevents overflow
                                        minWidth: 0,
                                    }}
                                >
                                    <Form.Group className="mb-0">
                                        {label ? (
                                            <Form.Label
                                                className="mb-1 text-muted small fw-semibold">{label}</Form.Label>
                                        ) : null}
                                        <div className="flex-grow-1">{element}</div>
                                    </Form.Group>
                                </div>
                            ))}
                        </div>

                        {/* Action bar under filters */}
                        <div
                            className="d-flex flex-wrap gap-2 justify-content-between align-items-center mt-3 pt-2 border-top">
                            <div className="d-flex flex-wrap gap-2">
                                {handleReset && (
                                    <Button size="sm" variant="outline-secondary" onClick={handleReset}>
                                        Reset
                                    </Button>
                                )}
                                {showBulkDelete && (
                                    <OverlayTrigger placement="bottom" overlay={<Tooltip>Delete selected</Tooltip>}>
                                        <Button size="sm" variant="outline-danger" onClick={onDeleteSelected}>
                                            🗑️ Delete{' '}
                                            <Badge bg="light" text="dark" className="ms-1">
                                                {selectedIds.length}
                                            </Badge>
                                        </Button>
                                    </OverlayTrigger>
                                )}
                            </div>

                            <div className="d-flex flex-wrap gap-2">
                                {hasExports && (
                                    <SplitButton
                                        id="export-split"
                                        size="sm"
                                        title={
                                            <span className="d-inline-flex align-items-center">
                        <FaFileExport className="me-1"/> Export
                      </span>
                                        }
                                        variant="outline-secondary"
                                        onClick={handleExportCSV || handleExportPDF}
                                    >
                                        {handleExportCSV &&
                                            <Dropdown.Item onClick={handleExportCSV}>Export CSV</Dropdown.Item>}
                                        {handleExportPDF &&
                                            <Dropdown.Item onClick={handleExportPDF}>Export PDF</Dropdown.Item>}
                                    </SplitButton>
                                )}
                                {(onAddNewClick || onAddNew) && showAdd && (
                                    <Button variant="primary" size="sm" onClick={onAddNewClick || onAddNew}>
                                        <FaPlus className="me-1"/> Add
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </Collapse>
            )}

            <hr className="mt-2 mb-0 text-muted opacity-25"/>
        </div>
    );
};

export default ListControls;
