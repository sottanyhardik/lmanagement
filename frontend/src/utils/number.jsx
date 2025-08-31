// src/utils/number.js
export const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export const round2 = (n) => Number(safeNum(n).toFixed(2));

// Quantities are whole numbers in your flows
export const roundQty = (n) => {
    const x = Math.floor(safeNum(n));
    return Number.isFinite(x) ? x : 0;
};

// "en-IN" 2-decimal formatting; "-" for non-finite
export const fmt = (n) => {
    const v = Number(n ?? 0);
    if (!Number.isFinite(v)) return "-";
    return v.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
};
