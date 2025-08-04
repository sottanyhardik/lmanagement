// entityCache.js
import axios from '../api/axiosInstance';

let cachedEntities = null;

export async function fetchEntities() {
    if (cachedEntities) return cachedEntities;
    const res = await axios.get('/api/invoice-entities/?limit=1000');
    cachedEntities = res.data.results;
    return cachedEntities;
}
