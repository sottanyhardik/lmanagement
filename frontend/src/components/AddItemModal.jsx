import React, {useEffect, useRef} from 'react';
import {Button, Form, Modal} from 'react-bootstrap';

const AddItemModal = ({
                          show,
                          handleClose,
                          fields,
                          newItem,
                          setNewItem,
                          addErrors,
                          renderInput,
                          handleAdd,
                          loading,
                      }) => {
    const firstInputRef = useRef();

    useEffect(() => {
        if (show) setTimeout(() => firstInputRef.current?.focus(), 150);
    }, [show]);

    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title>➕ Add</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {fields.map((f, idx) => (
                    <Form.Group className="mb-3" key={f.name}>
                        <Form.Label>{f.label}</Form.Label>
                        {renderInput[f.name] ? (
                            renderInput[f.name](newItem[f.name], (val) =>
                                setNewItem((prev) => ({...prev, [f.name]: val}))
                            )
                        ) : (
                            <Form.Control
                                ref={idx === 0 ? firstInputRef : null}
                                type="text"
                                isInvalid={!!addErrors[f.name]}
                                value={newItem[f.name] || ''}
                                onChange={(e) =>
                                    setNewItem((prev) => ({...prev, [f.name]: e.target.value}))
                                }
                            />
                        )}
                        <Form.Control.Feedback type="invalid">
                            {addErrors[f.name]}
                        </Form.Control.Feedback>
                    </Form.Group>
                ))}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleAdd} disabled={loading}>
                    {loading ? 'Adding...' : 'Add'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default AddItemModal;
