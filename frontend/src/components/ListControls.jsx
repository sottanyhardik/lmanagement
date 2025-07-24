import React, {useEffect} from 'react';
import {Button} from 'react-bootstrap';
import {FaPlus} from 'react-icons/fa';

const ListControls = ({
                          title = 'List',
                          search,
                          setSearch,
                          sortField,
                          sortOrder,
                          setSortField,
                          setSortOrder,
                          setPage,
                          selectedIds = [],
                          onDeleteSelected,
                          onAddNew,
                          showAdd = true,
                          sortOptions = [
                              {label: 'Newest', value: 'created_at:desc'},
                              {label: 'Recently Modified', value: 'modified_at:desc'},
                          ],
                          handleReset,
                          onAddNewClick,
                          extraFilters = [], // ✅ Accepts array of React components
                      }) => {
    useEffect(() => {
        document.title = title.toUpperCase();
    }, [title]);


    return (
        <div
            className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
            {/* Title */}
            <h2 className="fw-semibold text-primary mb-0 d-flex align-items-center">
                {title}
            </h2>

            {/* Controls */}
            {search && (
                <div
                    className="d-flex flex-wrap justify-content-start justify-content-md-end align-items-center gap-2 w-100 w-md-auto">
                    <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search..."
                        style={{minWidth: '160px'}}
                        value={search}
                        onChange={(e) => {
                            setPage(1);
                            setSearch(e.target.value);
                        }}
                    />
                    {extraFilters.map((component, index) => (
                        <div key={index} style={{minWidth: '200px', flexGrow: 1}}>
                            {component}
                        </div>
                    ))} <select
                    className="form-select form-select-sm"
                    style={{minWidth: '160px'}}
                    value={`${sortField}:${sortOrder}`}
                    onChange={(e) => {
                        const [field, order] = e.target.value.split(':');
                        setPage(1);
                        setSortField(field);
                        setSortOrder(order);
                    }}
                >
                    <option value=":">Sort By</option>
                    {sortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                    <Button size="sm" variant="outline-secondary" onClick={handleReset}>
                        Reset
                    </Button>

                    {selectedIds.length > 0 && (
                        <Button size="sm" variant="outline-danger" onClick={onDeleteSelected}>
                            🗑️ Delete ({selectedIds.length})
                        </Button>
                    )}
                    {onAddNew && (
                        <Button variant="primary" size="sm" onClick={onAddNew}>
                            <FaPlus className="me-1"/> Add
                        </Button>
                    )}
                    {showAdd && (
                        <Button size="sm" variant="primary" onClick={onAddNewClick}>
                            <FaPlus className="me-1"/> Add
                        </Button>
                    )}
                </div>
            )}
        </div>

    );
};

export default ListControls;
