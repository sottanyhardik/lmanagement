// src/components/ListControls.jsx
import React, {useEffect, useMemo, useState} from 'react';
import {Button} from 'react-bootstrap';
import {FaPlus} from 'react-icons/fa';

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
                          onAddNew,        // legacy
                          onAddNewClick,   // preferred
                          showAdd = true,

                          // Filters
                          Filters = [],

                          // Resets / exports
                          handleReset,
                          handleExportCSV,
                          handleExportPDF,
                      }) => {
    // Document title
    useEffect(() => {
        document.title = String(title || '').toUpperCase();
    }, [title]);

    // Local debounced search state
    const [query, setQuery] = useState(search || '');
    useEffect(() => setQuery(search || ''), [search]);
    useEffect(() => {
        const t = setTimeout(() => {
            if (setPage) setPage(1);
            setSearch?.(query);
        }, 300);
        return () => clearTimeout(t);
    }, [query, setSearch, setPage]);

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

    const AddHandler = onAddNewClick || onAddNew; // prefer onAddNewClick, fallback to onAddNew

    return (
        <div
            className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
            <h2 className="fw-semibold text-primary mb-0 d-flex align-items-center">{title}</h2>

            {onlyHeader && (
                <div
                    className="d-flex flex-wrap justify-content-start justify-content-md-end align-items-center gap-2 w-100 w-md-auto">
                    {/* Search */}
                    <div className="input-group input-group-sm" style={{minWidth: 220}}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search..."
                            aria-label="Search list"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        {query ? (
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setQuery('')}
                                title="Clear"
                            >
                                ×
                            </button>
                        ) : null}
                    </div>

                    {/* Filters (accepts array or single node) */}
                    {(Array.isArray(Filters) ? Filters : [Filters]).filter(Boolean).map((node, idx) => (
                        <div key={idx} style={{minWidth: 200, flexGrow: 1}}>
                            {node}
                        </div>
                    ))}

                    {/* Sort */}
                    <select
                        className="form-select form-select-sm"
                        style={{minWidth: 200}}
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
                    </select>

                    {/* Reset */}
                    {handleReset && (
                        <Button size="sm" variant="outline-secondary" onClick={handleReset}>
                            Reset
                        </Button>
                    )}

                    {/* Bulk delete */}
                    {selectedIds.length > 0 && onDeleteSelected && (
                        <Button size="sm" variant="outline-danger" onClick={onDeleteSelected}>
                            🗑️ Delete ({selectedIds.length})
                        </Button>
                    )}

                    {/* Add */}
                    {showAdd && AddHandler && (
                        <Button variant="primary" size="sm" onClick={AddHandler}>
                            <FaPlus className="me-1"/> Add
                        </Button>
                    )}

                    {/* Exports */}
                    {handleExportCSV && (
                        <button onClick={handleExportCSV} className="btn btn-outline-secondary btn-sm">
                            Export CSV
                        </button>
                    )}
                    {handleExportPDF && (
                        <button onClick={handleExportPDF} className="btn btn-outline-secondary btn-sm">
                            Export PDF
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ListControls;