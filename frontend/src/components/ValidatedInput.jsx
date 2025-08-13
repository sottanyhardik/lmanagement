// src/components/ValidatedInput.jsx
import React, {forwardRef, useId} from 'react';
import {Form} from 'react-bootstrap';

const ValidatedInput = forwardRef(function ValidatedInput(
    {
        label,
        name,
        value,
        onChange,
        placeholder,
        error,
        type = 'text',
        helpText,
        required = false,
        trimOnBlur = false,
        maxLength,
        showCounter = false,
        ...rest
    },
    ref
) {
    const autoId = useId();
    const id = rest.id || `${name || 'input'}-${autoId}`;
    const helpId = helpText ? `${id}-help` : undefined;
    const countId = showCounter && typeof maxLength === 'number' ? `${id}-count` : undefined;
    const describedBy = [helpId, countId].filter(Boolean).join(' ') || undefined;

    const handleBlur = (e) => {
        if (trimOnBlur && typeof e.target.value === 'string') {
            const trimmed = e.target.value.trim();
            if (trimmed !== e.target.value) {
                // bubble a "change" with the trimmed value
                onChange?.({...e, target: {...e.target, value: trimmed}});
            }
        }
        rest.onBlur?.(e);
    };

    return (
        <Form.Group className="mb-3">
            {label && (
                <Form.Label htmlFor={id} className="mb-1">
                    {label} {required && <span className="text-danger">*</span>}
                </Form.Label>
            )}

            <Form.Control
                id={id}
                name={name}
                type={type}
                value={value ?? ''}
                onChange={onChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                isInvalid={!!error}
                required={required}
                maxLength={maxLength}
                aria-describedby={describedBy}
                // friendlier mobile keyboards for numeric inputs
                {...(type === 'number' ? {inputMode: 'decimal', pattern: '[0-9]*'} : {})}
                ref={ref}
                {...rest}
            />

            {error && (
                <Form.Control.Feedback type="invalid">
                    {error}
                </Form.Control.Feedback>
            )}

            {helpText && (
                <Form.Text id={helpId} muted>
                    {helpText}
                </Form.Text>
            )}

            {showCounter && typeof maxLength === 'number' && (
                <div id={countId} className="form-text text-end small">
                    {(value?.length ?? 0)}/{maxLength}
                </div>
            )}
        </Form.Group>
    );
});

export default ValidatedInput;
