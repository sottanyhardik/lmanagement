// utils/templateCache.js
import axios from '../api/axiosInstance';

let cachedTemplates = null;

export async function fetchTransferLetterTemplates() {
    if (cachedTemplates) return cachedTemplates;
    const res = await axios.get('/api/transfer-letters/');
    const data = res.data?.results || res.data;
    cachedTemplates = Array.isArray(data) ? data : [];
    return cachedTemplates;
}
