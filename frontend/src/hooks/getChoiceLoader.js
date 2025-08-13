// getChoiceLoader.js

/**
 * Build a client-side loader for react-select AsyncSelect from a local choices map.
 *
 * @param {Record<string, Array<{label:string,value:any}>>} choices
 * @param {string} key - which choices array to use
 * @param {object} [opts]
 * @param {number} [opts.maxResults=50] - cap results
 * @param {number} [opts.minLength=0]   - minimum chars before filtering (else return top list)
 * @param {boolean} [opts.sortStartsFirst=true] - "starts with" matches before "contains"
 * @param {boolean} [opts.trim=true]    - trim input before matching
 * @returns {(inputValue: string, callback?: (opts:any[])=>void)=>Promise<any[]>}
 */
export function getChoiceLoader(
    choices,
    key,
    {maxResults = 50, minLength = 0, sortStartsFirst = true, trim = true} = {}
) {
    const group = Array.isArray(choices?.[key]) ? choices[key] : [];

    // Precompute a normalized label for fast case/diacritic-insensitive search
    const withNorm = group.map((opt) => ({
        ...opt,
        _norm: normalize(opt?.label),
    }));

    const filter = (raw) => {
        const q = normalize(raw, trim);
        if (q.length < minLength) {
            return withNorm.slice(0, maxResults).map(stripNorm);
        }

        let pool = withNorm.filter((o) => o._norm.includes(q));

        if (sortStartsFirst && q) {
            pool.sort((a, b) => {
                const aStarts = a._norm.startsWith(q);
                const bStarts = b._norm.startsWith(q);
                if (aStarts !== bStarts) return aStarts ? -1 : 1;
                return String(a.label || '').localeCompare(String(b.label || ''));
            });
        }

        return pool.slice(0, maxResults).map(stripNorm);
    };

    // AsyncSelect supports returning a Promise OR using the callback. We do both.
    return function loadOptions(inputValue, callback) {
        const out = filter(inputValue ?? '');
        if (callback) callback(out);
        return Promise.resolve(out);
    };
}

// Helpers
function normalize(s, doTrim = true) {
    const t = String(s ?? '');
    const v = doTrim ? t.trim() : t;
    // NFD + strip combining marks = diacritic-insensitive
    return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function stripNorm(o) {
    const {_norm, ...rest} = o;
    return rest;
}
