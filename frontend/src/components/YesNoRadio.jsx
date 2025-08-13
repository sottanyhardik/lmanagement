// components/YesNoRadio.jsx
import React, {forwardRef, useId} from 'react';
import {Form} from 'react-bootstrap';

const YesNoRadio = forwardRef(function YesNoRadio(
    {
        label,
        name,
        value,                 // true | false | null
        onChange,
        allowAll = true,       // show the "All" option
        allLabel = 'All',
        yesLabel = 'Yes',
        noLabel = 'No',
        inline = true,         // render radios inline
        disabled = false,
        isInvalid = false,
        helpText,              // optional hint below the group
        className,
    },
    ref
) {
    const uid = useId();
    const groupName = name || `yesno-${uid}`;
    const idAll = `${groupName}-all`;
    const idYes = `${groupName}-yes`;
    const idNo = `${groupName}-no`;
    const describedBy = helpText ? `${groupName}-help` : undefined;

    const handle = (val) => () => onChange?.(val);

    return (
        <Form.Group className={className}>
            {label && (
                <Form.Label className="d-block mb-1" htmlFor={allowAll ? idAll : idYes}>
                    {label}
                </Form.Label>
            )}

            <div role="radiogroup" aria-describedby={describedBy}>
                {allowAll && (
                    <Form.Check
                        ref={ref}
                        id={idAll}
                        type="radio"
                        inline={inline}
                        label={allLabel}
                        name={groupName}
                        checked={value === null || value === undefined}
                        onChange={handle(null)}
                        disabled={disabled}
                        isInvalid={isInvalid}
                    />
                )}

                <Form.Check
                    id={idYes}
                    type="radio"
                    inline={inline}
                    label={yesLabel}
                    name={groupName}
                    checked={value === true}
                    onChange={handle(true)}
                    disabled={disabled}
                    isInvalid={isInvalid}
                />

                <Form.Check
                    id={idNo}
                    type="radio"
                    inline={inline}
                    label={noLabel}
                    name={groupName}
                    checked={value === false}
                    onChange={handle(false)}
                    disabled={disabled}
                    isInvalid={isInvalid}
                />
            </div>

            {helpText && (
                <Form.Text id={describedBy} muted>
                    {helpText}
                </Form.Text>
            )}

            {isInvalid && (
                <div className="invalid-feedback d-block">
                    {/* supply the actual error text where you use this component */}
                </div>
            )}
        </Form.Group>
    );
});

export default YesNoRadio;
