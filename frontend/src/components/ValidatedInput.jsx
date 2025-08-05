import React from 'react';
import {Form} from 'react-bootstrap';

const ValidatedInput = ({label, value, onChange, placeholder, error, type = 'text', ...rest}) => {
    return (
        <Form.Group className="mb-3">
            {label && <Form.Label>{label}</Form.Label>}
            <Form.Control
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                isInvalid={!!error}
                {...rest}
            />
            <Form.Control.Feedback type="invalid">
                {error}
            </Form.Control.Feedback>
        </Form.Group>
    );
};

export default ValidatedInput;
