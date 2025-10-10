import React from 'react';
import AsyncSelect from 'react-select/async';
import api from '../../api/axiosInstance';

// ---------- helpers ----------
const join = (endpoint) => String(endpoint || '').replace(/^\/+|\/+$/g, '') + '/';

const toOption = (norm) =>
    norm
        ? {
            value: norm.id,
            label: norm.head_norm?.name
                ? `${norm.norm_class} — ${norm.head_norm.name}`
                : String(norm.norm_class ?? norm.id),
            data: norm,
        }
        : null;

// Accept: id | raw object | option | accidental row with { norm_class: {...} }
const normalizeIncoming = (v) => {
    if (v == null || v === '') return null;

    // unwrap accidental `{ norm_class: {...} }`
    if (
        typeof v === 'object' &&
        v.norm_class &&
        typeof v.norm_class === 'object' &&
        'id' in v.norm_class
    ) {
        v = v.norm_class;
    }

    // already option-like
    if (typeof v === 'object' && 'value' in v && 'label' in v) {
        return 'data' in v ? v : {...v, data: {id: v.value, name: v.label}};
    }

    // raw object
    if (typeof v === 'object' && 'id' in v) return toOption(v);

    // primitive id
    if (typeof v === 'number' || typeof v === 'string') {
        const id = String(v).trim();
        return id ? {value: Number(id) || id, label: String(id)} : null;
    }

    return null;
};

async function fetchNormById(endpoint, id) {
    const ep = join(endpoint);
    const url = `${ep}${id}/`; // e.g. sion-classes/11/
    const {data} = await api.get(url);
    return data;
}

async function searchNorms(endpoint, query, pageSize) {
    const ep = join(endpoint);
    const params = {};
    if (query?.trim()) params.search = query.trim();
    if (pageSize) params.page_size = pageSize;

    const {data} = await api.get(ep, {params});
    // supports both `{ results: [...] }` and `[...]`
    const items = Array.isArray(data) ? data : data?.results || [];
    return items;
}

// ---------- component ----------
export default function AsyncNormSelect({
                                            value,
                                            onChange,
                                            placeholder = 'Select SION Norm',
                                            endpoint = 'sion-classes/',
                                            defaultOptions = true,      // load first page on mount/open
                                            minChars = 2,               // chars before search triggers
                                            debounceMs = 300,
                                            pageSize = 25,
                                            isDisabled = false,
                                            ...props
                                        }) {
    const [displayValue, setDisplayValue] = React.useState(() => normalizeIncoming(value));
    const debounceRef = React.useRef(null);
    const mountedRef = React.useRef(true);

    // keep in sync if parent changes value
    React.useEffect(() => {
        setDisplayValue(normalizeIncoming(value));
    }, [value]);

    // hydrate when we only have a primitive id or option without data
    React.useEffect(() => {
        mountedRef.current = true;
        const v = displayValue;
        const looksLikeId =
            v &&
            (v.data == null) &&
            v.value != null &&
            (v.label == null || v.label === String(v.value));

        const numericId =
            v?.value != null &&
            (typeof v.value === 'number' || !Number.isNaN(Number(v.value)));

        if (looksLikeId && numericId) {
            const id = Number(v.value) || v.value;
            fetchNormById(endpoint, id)
                .then((norm) => {
                    if (!mountedRef.current) return;
                    setDisplayValue(toOption(norm));
                })
                .catch(() => {
                    // ignore; keep fallback label
                });
        }

        return () => {
            mountedRef.current = false;
        };
    }, [displayValue, endpoint]);

    // debounced async loader for react-select
    const loadOptions = React.useCallback(
        (inputValue) =>
            new Promise((resolve) => {
                const q = (inputValue || '').trim();

                // clear prior debounce
                if (debounceRef.current) clearTimeout(debounceRef.current);

                debounceRef.current = setTimeout(async () => {
                    try {
                        // If empty query:
                        // - when defaultOptions is true, fetch first page
                        // - else, show nothing
                        if (!q) {
                            if (!defaultOptions) return resolve([]);
                            const items = await searchNorms(endpoint, '', pageSize);
                            resolve(items.map(toOption).filter(Boolean));
                            return;
                        }

                        // enforce min chars
                        if (q.length < minChars) {
                            resolve([]);
                            return;
                        }

                        const items = await searchNorms(endpoint, q, pageSize);
                        resolve(items.map(toOption).filter(Boolean));
                    } catch {
                        resolve([]);
                    }
                }, debounceMs);
            }),
        [endpoint, defaultOptions, minChars, debounceMs, pageSize]
    );

    // return RAW server object (opt.data) to the parent
    const handleChange = React.useCallback(
        (opt) => {
            setDisplayValue(opt ?? null);
            onChange?.(opt ? opt.data ?? null : null);
        },
        [onChange]
    );

    // force remount when selected id changes → fixes single-value repaint quirk
    const selectKey =
        displayValue?.value != null ? `norm-${displayValue.value}` : 'norm-none';

    return (
        <AsyncSelect
            key={selectKey}
            classNamePrefix="react-select"
            className="underline-select"
            isDisabled={isDisabled}
            isClearable
            cacheOptions
            defaultOptions={defaultOptions}
            loadOptions={loadOptions}
            value={displayValue}
            onChange={handleChange}
            placeholder={placeholder}
            getOptionLabel={(opt) => opt.label}
            getOptionValue={(opt) => String(opt.value)}
            // better inside modals:
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            styles={{
                menuPortal: (base) => ({...base, zIndex: 9999}),
                control: (base) => ({...base, minHeight: 32, fontSize: '0.875rem'}),
            }}
            noOptionsMessage={({inputValue}) =>
                inputValue && inputValue.trim().length < minChars
                    ? `Type at least ${minChars} characters...`
                    : 'No norms found'
            }
            {...props}
        />
    );
}
