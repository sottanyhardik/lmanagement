// src/components/auth/PasswordField.jsx
import React, {useState} from 'react';
import {Button, Form, InputGroup} from 'react-bootstrap';

const PasswordField = ({
                           id,
                           label,
                           placeholder = 'Password',
                           value,
                           onChange,
                           disabled,
                           isInvalid,
                           feedback,
                           minLength = 8,
                           autoComplete = 'current-password',
                       }) => {
    const [show, setShow] = useState(false);

    return (
        <Form.Group className="mb-3" controlId={id}>
            {label && <Form.Label>{label}</Form.Label>}
            <InputGroup>
                <Form.Control
                    type={show ? 'text' : 'password'}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    isInvalid={isInvalid}
                    minLength={minLength}
                    autoComplete={autoComplete}
                    required
                />
                <Button
                    variant="outline-secondary"
                    onClick={() => setShow((s) => !s)}
                    disabled={disabled}
                    title={show ? 'Hide password' : 'Show password'}
                >
                    {show ? 'Hide' : 'Show'}
                </Button>
                {feedback && <Form.Control.Feedback type="invalid">{feedback}</Form.Control.Feedback>}
            </InputGroup>
        </Form.Group>
    );
};

export default PasswordField;
