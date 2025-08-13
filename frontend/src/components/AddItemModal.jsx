import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {Button, Form, Modal} from 'react-bootstrap';

/**
 * @param {{
 *  show: boolean,
 *  handleClose: () => void,
 *  fields: Array<{ name: string, label: string, placeholder?: string, required?: boolean }>,
 *  newItem: Record<string, any>,
 *  setNewItem: (updater: (prev: any) => any) => void,
 *  addErrors: Record<string, string>,
 *  renderInput?: Record<string, (value:any, onChange:(val:any)=>void) => React.ReactNode>,
 *  handleAdd: () => Promise<void> | void,
 *  loading?: boolean,
 *  title?: string
 * }} props
 */
const AddItemModal = ({
                          show,
                          handleClose,
                          fields = [],
                          newItem = {},
                          setNewItem,
                          addErrors = {},
                          renderInput = {},
                          handleAdd,
                          loading = false,
                          title = '➕ Add',
                      }) => {
    const firstInputRef = useRef(null);

    // autofocus first input when the modal opens
    useEffect(() => {
        if (show) {
            const t = setTimeout(() => firstInputRef.current?.focus(), 150);
            return () => clearTimeout(t);
        }
    }, [show]);

    const canSubmit = useMemo(() => !loading, [loading]);

    const onChangeField = useCallback(
        (name, value) => {
            setNewItem(prev => ({...prev, [name]: value}));
        },
        [setNewItem]
    );

    const onSubmit = useCallback(
        async (e) => {
            e.preventDefault();
            if (!canSubmit) return;
            await handleAdd?.();
        },
        [handleAdd, canSubmit]
    );

    return (
        <Modal
            show={show}
            onHide={loading ? undefined : handleClose}
            centered
            backdrop="static"
            keyboard={!loading}
        >
            <Form onSubmit={onSubmit}>
                <Modal.Header closeButton={!loading}>
                    <Modal.Title>{title}</Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    {fields.map((f, idx) => {
                        const error = addErrors?.[f.name];
                        const value = newItem?.[f.name] ?? '';
                        const customRenderer = renderInput?.[f.name];

                        return (
                            <Form.Group className="mb-3" key={f.name}>
                                <Form.Label>{f.label}{f.required ? ' *' : ''}</Form.Label>

                                {typeof customRenderer === 'function' ? (
                                    customRenderer(value, (val) => onChangeField(f.name, val))
                                ) : (
                                    <Form.Control
                                        ref={idx === 0 ? firstInputRef : null}
                                        type="text"
                                        value={value}
                                        isInvalid={!!error}
                                        placeholder={f.placeholder || ''}
                                        required={!!f.required}
                                        onChange={(e) => onChangeField(f.name, e.target.value)}
                                        disabled={loading}
                                    />
                                )}

                                <Form.Control.Feedback type="invalid">
                                    {error}
                                </Form.Control.Feedback>
                            </Form.Group>
                        );
                    })}
                </Modal.Body>

                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" disabled={!canSubmit}>
                        {loading ? 'Adding...' : 'Add'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

export default React.memo(AddItemModal);
