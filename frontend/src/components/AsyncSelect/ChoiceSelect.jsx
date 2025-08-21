// src/components/ChoiceSelect.jsx
import React, {useCallback, useMemo} from "react";
import AsyncSelect from "react-select/async";
import {useLicenseChoices} from "../../hooks/useChoiceLoader.js";
import {getChoiceLoader} from "../../hooks/getChoiceLoader.js";

function toResolvedOption(v, valueMap) {
    if (v == null) return null;
    if (typeof v === "object" && "value" in v) return valueMap.get(v.value) || v;
    if (typeof v === "string" || typeof v === "number") {
        return valueMap.get(v) || {value: v, label: String(v)};
    }
    return null;
}

export default function ChoiceSelect({
                                         choiceKey,
                                         value,
                                         onChange,
                                         isMulti = false,
                                         placeholder,
                                         isClearable = true,
                                         isDisabled = false,
                                         returnValues = false,
                                         defaultOptionsCount = 100,
                                         instanceId,
                                         ...props
                                     }) {
    const {choices, loading} = useLicenseChoices();
    const group = useMemo(() => choices?.[choiceKey] || [], [choices, choiceKey]);

    const valueMap = useMemo(() => new Map(group.map((o) => [o.value, o])), [group]);

    const resolvedValue = useMemo(() => {
        if (isMulti) {
            const arr = Array.isArray(value) ? value : value == null ? [] : [value];
            return arr.map((v) => toResolvedOption(v, valueMap)).filter(Boolean);
        }
        return toResolvedOption(value, valueMap);
    }, [value, valueMap, isMulti]);

    const loadOptions = useMemo(
        () =>
            getChoiceLoader(
                {[choiceKey]: group},
                choiceKey,
                {maxResults: 300, minLength: 0, sortStartsFirst: true}
            ),
        [group, choiceKey]
    );

    const handleChange = useCallback(
        (selected) => {
            if (!onChange) return;
            if (!returnValues) {
                onChange(selected);
                return;
            }
            if (isMulti) {
                onChange((selected || []).map((s) => s?.value).filter((v) => v != null));
            } else {
                onChange(selected?.value ?? null);
            }
        },
        [onChange, returnValues, isMulti]
    );

    const portalTarget = typeof document !== "undefined" ? document.body : undefined;

    if (loading && !group.length) {
        return (
            <div style={{fontSize: 12, opacity: 0.7}}>
                Loading choices for {String(choiceKey)}…
            </div>
        );
    }

    return (
        <AsyncSelect
            cacheOptions
            defaultOptions={group.slice(0, defaultOptionsCount)}
            loadOptions={loadOptions}
            value={resolvedValue}
            onChange={handleChange}
            isMulti={isMulti}
            isLoading={loading}
            isClearable={isClearable}
            isDisabled={isDisabled}
            placeholder={placeholder ?? `Select ${String(choiceKey).replace(/_/g, " ")}`}
            classNamePrefix="react-select"
            className="underline-select"
            instanceId={instanceId || `choice-${choiceKey}`}
            blurInputOnSelect={!isMulti}
            captureMenuScroll
            maxMenuHeight={280}
            menuPortalTarget={portalTarget}
            styles={portalTarget ? {menuPortal: (base) => ({...base, zIndex: 9999})} : undefined}
            {...props}
        />
    );
}
