// src/hooks/getChoiceLoader.js

/**
 * Build client-side async loader for react-select AsyncSelect
 */
export function getChoiceLoader(
    choices,
    key,
    {maxResults = 50, minLength = 0, sortStartsFirst = true, trim = true} = {}
) {
    const group = Array.isArray(choices?.[key]) ? choices[key] : [];

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
                return String(a.label || "").localeCompare(String(b.label || ""));
            });
        }

        return pool.slice(0, maxResults).map(stripNorm);
    };

    return function loadOptions(inputValue, callback) {
        const out = filter(inputValue ?? "");
        if (callback) callback(out);
        return Promise.resolve(out);
    };
}

function normalize(s, doTrim = true) {
    const t = String(s ?? "");
    const v = doTrim ? t.trim() : t;
    return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function stripNorm(o) {
    const {_norm, ...rest} = o;
    return rest;
}
