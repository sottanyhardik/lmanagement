// components/YesNoRadio.jsx
import React from 'react';
import {Form} from 'react-bootstrap';

const YesNoRadio = ({label, value, onChange}) => {
    return (
        <Form.Group>
            {label && <Form.Label className="d-block mb-1">{label}</Form.Label>}
            <div className="d-flex gap-3">
                <Form.Check
                    type="radio"
                    label="All"
                    name={label}
                    checked={value === null}
                    onChange={() => onChange(null)}
                />
                <Form.Check
                    type="radio"
                    label="Yes"
                    name={label}
                    checked={value === true}
                    onChange={() => onChange(true)}
                />
                <Form.Check
                    type="radio"
                    label="No"
                    name={label}
                    checked={value === false}
                    onChange={() => onChange(false)}
                />
            </div>
        </Form.Group>
    );
};

export default YesNoRadio;
