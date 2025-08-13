// src/utils/parseFormErrors.js

/**
 * Flatten DRF-style error responses to a dot-notation map.
 * Examples:
 *  { name: ["This field is required."] }
 *    -> { "name": "This field is required." }
 *
 *  { items: [ { code: ["Required"] }, { qty: ["Invalid"] } ] }
 *    -> { "items.0.code": "Required", "items.1.qty": "Invalid" }
 */
export function parseFormErrors(err) {
    const data = err?.response?.data ?? err?.data ?? err ?? {};
    const out = {};

    const push = (key, val) => {
        if (val == null || val === '') return;
        const msg = Array.isArray(val) ? val.filter(Boolean).join(', ') : String(val);
        if (key) {
            out[key] = out[key] ? `${out[key]}; ${msg}` : msg;
        } else {
            // global bucket
            out.non_field_errors = out.non_field_errors ? `${out.non_field_errors}; ${msg}` : msg;
        }
    };

    const walk = (node, path = '') => {
        if (node == null) return;

        if (Array.isArray(node)) {
            const allPrims = node.every(
                v => ['string', 'number', 'boolean'].includes(typeof v)
            );
            if (allPrims) {
                push(path, node.map(String));
                return;
            }
            node.forEach((child, i) => walk(child, path ? `${path}.${i}` : String(i)));
            return;
        }

        if (typeof node === 'object') {
            const keys = Object.keys(node);
            if (!keys.length) return;

            keys.forEach((k) => {
                const v = node[k];

                // Known global keys (DRF)
                if ((k === 'non_field_errors' || k === '__all__' || k === 'detail')
                    && (typeof v !== 'object' || Array.isArray(v))) {
                    push('', v);
                    return;
                }

                const nextPath = path ? `${path}.${k}` : k;

                if (Array.isArray(v)) {
                    const allPrims = v.every(x => ['string', 'number', 'boolean'].includes(typeof x));
                    if (allPrims) {
                        push(nextPath, v.map(String));
                    } else {
                        v.forEach((child, i) => walk(child, `${nextPath}.${i}`));
                    }
                    return;
                }

                if (typeof v === 'object' && v) {
                    walk(v, nextPath);
                    return;
                }

                // primitive
                push(nextPath, v);
            });
            return;
        }

        // primitive at root
        push(path, node);
    };

    walk(data);

    // Fallback if only {detail: "..."} existed
    if (!Object.keys(out).length && typeof data?.detail === 'string') {
        out.non_field_errors = data.detail;
    }

    return out;
}

/** Pick a single, user-friendly message (great for toasts) */
export function summarizeErrors(flatErrors, fallback = 'Please fix the highlighted errors.') {
    if (!flatErrors || typeof flatErrors !== 'object') return fallback;
    if (flatErrors.non_field_errors) return flatErrors.non_field_errors;
    const first = Object.values(flatErrors)[0];
    return typeof first === 'string' ? first : fallback;
}
