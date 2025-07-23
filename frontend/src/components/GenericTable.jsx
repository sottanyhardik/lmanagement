// src/components/GenericTable.jsx
import React from 'react';

const GenericTable = ({
                          loading,
                          items,
                          fields,
                          selectedIds,
                          editIndex,
                          editedItem,
                          errors,
                          renderInput,
                          renderField,
                          inputRef,
                          sortField,
                          sortOrder,
                          toggleSort,
                          toggleSelect,
                          toggleSelectAll,
                          handleChange,
                          handleSave,
                          handleCancel,
                          handleEditClick,
                          setEditedItem,
                      }) => {
    if (loading) return <p>Loading...</p>;

    return (
        <table className="table table-sm table-hover table-striped align-middle">
            <thead className="table-light">
            <tr className="text-nowrap">
                <th>
                    <div className="form-check form-switch">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            checked={items.length > 0 && items.every((c) => selectedIds.includes(c.id))}
                            onChange={toggleSelectAll}
                        />
                    </div>
                </th>
                {fields.map((f) => (
                    <th
                        key={f.name}
                        style={{cursor: 'pointer'}}
                        onClick={() => toggleSort(f.name)}
                    >
                        {f.label}
                        {sortField === f.name &&
                            (sortOrder === 'asc' ? ' ▲' : sortOrder === 'desc' ? ' ▼' : '')}
                    </th>
                ))}
                <th className="text-center">Actions</th>
            </tr>
            </thead>
            <tbody>
            {items.map((item, index) => (
                <tr key={item.id}>
                    <td>
                        <div className="form-check form-switch">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedIds.includes(item.id)}
                                onChange={() => toggleSelect(item.id)}
                            />
                        </div>
                    </td>
                    {fields.map((f) => (
                        <td key={f.name}>
                            {editIndex === index ? (
                                renderInput[f.name] ? (
                                    renderInput[f.name](editedItem[f.name], (val) =>
                                        setEditedItem((prev) => ({
                                            ...prev,
                                            [f.name]: val,
                                        }))
                                    )
                                ) : (
                                    <>
                                        <input
                                            ref={
                                                f.name === fields[0].name
                                                    ? inputRef
                                                    : null
                                            }
                                            type="text"
                                            name={f.name}
                                            className={`form-control form-control-sm ${
                                                errors[f.name] ? 'is-invalid' : ''
                                            }`}
                                            value={editedItem[f.name] || ''}
                                            onChange={handleChange}
                                        />
                                        {errors[f.name] && (
                                            <div className="invalid-feedback">
                                                {errors[f.name]}
                                            </div>
                                        )}
                                    </>
                                )
                            ) : renderField[f.name] ? (
                                renderField[f.name](item[f.name], item)
                            ) : (
                                item[f.name]
                            )}
                        </td>
                    ))}
                    <td className="text-center">
                        {editIndex === index ? (
                            <div className="d-flex gap-1 justify-content-center">
                                <button
                                    className="btn btn-success btn-sm"
                                    onClick={handleSave}
                                >
                                    💾
                                </button>
                                <button
                                    className="btn btn-outline-success btn-sm"
                                    onClick={handleCancel}
                                >
                                    ❌
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleEditClick(index)}
                            >
                                ✏️
                            </button>
                        )}
                    </td>
                </tr>
            ))}
            </tbody>
        </table>
    );
};

export default GenericTable;
