// src/components/GenericTable.jsx
import React, {useCallback, useMemo, useRef} from 'react';

const noop = () => {
};
const ACTIONS_COL_WIDTH = 120;

/** Single row (with optional expanded panel) */
function DataRow({
                     item,
                     index,
                     fields,
                     selectedIds,
                     editIndex,
                     editedItem,
                     errors,
                     renderInput,
                     renderField,
                     inputRef,
                     toggleSelect,
                     handleChange,
                     handleSave,
                     handleCancel,
                     handleEditClick,
                     setEditedItem,
                     onDelete,
                     deletingId,
                     isExpanded,
                     onToggleExpand,
                     renderExpanded,
                 }) {
    const isEditing = editIndex === index;
    const firstInputRef = useRef(null);

    const onKeyDownEdit = useCallback(
        (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        },
        [handleSave, handleCancel]
    );

    return (
        <>
            <tr data-row-index={index}>
                {/* Select */}
                <td style={{width: 36}}>
                    <div className="form-check">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            aria-label={`Select row ${index + 1}`}
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelect(item.id)}
                        />
                    </div>
                </td>

                {/* Cells */}
                {fields.map((f, colIdx) => {
                    const InputRenderer = renderInput?.[f.name];
                    const FieldRenderer = renderField?.[f.name];
                    const value = isEditing ? editedItem?.[f.name] : item?.[f.name];
                    const hasError = !!errors?.[f.name];

                    if (isEditing) {
                        return (
                            <td key={f.name} onKeyDown={onKeyDownEdit}>
                                {typeof InputRenderer === 'function' ? (
                                    InputRenderer(value, (val) =>
                                        setEditedItem((prev) => ({...prev, [f.name]: val}))
                                    )
                                ) : (
                                    <>
                                        <input
                                            ref={colIdx === 0 ? inputRef || firstInputRef : null}
                                            type="text"
                                            name={f.name}
                                            className={`form-control form-control-sm ${hasError ? 'is-invalid' : ''}`}
                                            value={value ?? ''}
                                            onChange={handleChange}
                                        />
                                        {hasError && <div className="invalid-feedback">{errors[f.name]}</div>}
                                    </>
                                )}
                            </td>
                        );
                    }

                    return (
                        <td key={f.name}>
                            {typeof FieldRenderer === 'function' ? FieldRenderer(value, item) : (value ?? '')}
                        </td>
                    );
                })}

                {/* Actions */}
                <td className="text-center" style={{whiteSpace: 'nowrap', width: ACTIONS_COL_WIDTH}}>
                    {isEditing ? (
                        <div className="d-flex gap-1 justify-content-center">
                            <button type="button" className="btn btn-success btn-sm" onClick={handleSave} title="Save">
                                💾
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={handleCancel}
                                title="Cancel"
                            >
                                ❌
                            </button>
                        </div>
                    ) : (
                        <div className="d-flex gap-1 justify-content-center">
                            {!!renderExpanded && (
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => onToggleExpand(item)}
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                    {isExpanded ? '▾' : '▸'}
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleEditClick(index)}
                                title="Edit"
                            >
                                ✏️
                            </button>
                            {!!onDelete && (
                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => onDelete(item)}
                                    disabled={deletingId === item.id}
                                    title="Delete"
                                >
                                    {deletingId === item.id ? '…' : '🗑️'}
                                </button>
                            )}
                        </div>
                    )}
                </td>
            </tr>

            {/* Expanded panel */}
            {renderExpanded && isExpanded && (
                <tr>
                    <td colSpan={fields.length + 2} style={{background: '#fafafa'}}>
                        <div className="p-2">{renderExpanded(item)}</div>
                    </td>
                </tr>
            )}
        </>
    );
}

/** Non-virtualized table */
export default function GenericTable({
                                         loading = false,
                                         items = [],
                                         fields = [],
                                         selectedIds = [],
                                         editIndex = -1,
                                         editedItem = {},
                                         errors = {},
                                         renderInput = {},
                                         renderField = {},
                                         inputRef,
                                         sortField,
                                         sortOrder,
                                         toggleSort = noop,
                                         toggleSelect = noop,
                                         toggleSelectAll = noop,
                                         handleChange = noop,
                                         handleSave = noop,
                                         handleCancel = noop,
                                         handleEditClick = noop,
                                         setEditedItem = noop,
                                         onDelete,
                                         deletingId,
                                         emptyMessage = 'No records found.',
                                         renderExpanded,        // (item) => ReactNode to enable expansion
                                         expandedIds,           // optional controlled Set/Array of expanded item ids
                                         onToggleExpand,        // optional controlled toggle handler
                                     }) {
    const expandedSet = useMemo(() => new Set(expandedIds || []), [expandedIds]);

    const allSelected = useMemo(
        () => items.length > 0 && items.every((c) => selectedIds.includes(c.id)),
        [items, selectedIds]
    );

    const toggleExpand = useCallback(
        (item) => {
            onToggleExpand?.(item); // parent manages expandedIds (controlled)
        },
        [onToggleExpand]
    );

    if (loading) return <p className="m-2">Loading...</p>;

    return (
        <div className="table-responsive">
            <table className="table table-sm table-hover table-striped align-middle">
                <thead className="table-light">
                <tr className="text-nowrap">
                    <th style={{width: 36}}>
                        <div className="form-check">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                aria-label="Select all rows"
                                checked={allSelected}
                                onChange={toggleSelectAll}
                            />
                        </div>
                    </th>
                    {fields.map((f) => {
                        const isActive = sortField === f.name;
                        const chevron = isActive ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : '';
                        return (
                            <th
                                key={f.name}
                                style={{cursor: 'pointer'}}
                                onClick={() => toggleSort(f.name)}
                                aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                {f.label}
                                {chevron}
                            </th>
                        );
                    })}
                    <th className="text-center" style={{width: ACTIONS_COL_WIDTH}}>Actions</th>
                </tr>
                </thead>

                <tbody>
                {items.length === 0 ? (
                    <tr>
                        <td colSpan={fields.length + 2} className="text-center text-muted py-4">
                            {emptyMessage}
                        </td>
                    </tr>
                ) : (
                    items.map((item, index) => (
                        <DataRow
                            key={item.id ?? index}
                            item={item}
                            index={index}
                            fields={fields}
                            selectedIds={selectedIds}
                            editIndex={editIndex}
                            editedItem={editedItem}
                            errors={errors}
                            renderInput={renderInput}
                            renderField={renderField}
                            inputRef={inputRef}
                            toggleSelect={toggleSelect}
                            handleChange={handleChange}
                            handleSave={handleSave}
                            handleCancel={handleCancel}
                            handleEditClick={handleEditClick}
                            setEditedItem={setEditedItem}
                            onDelete={onDelete}
                            deletingId={deletingId}
                            isExpanded={renderExpanded ? expandedSet.has(item.id) : false}
                            onToggleExpand={toggleExpand}
                            renderExpanded={renderExpanded}
                        />
                    ))
                )}
                </tbody>
            </table>
        </div>
    );
}
