// src/api/trades.js
import axios from './axiosInstance';

export const listTrades = (params) => axios.get('trades/', {params});
export const getTrade = (id) => axios.get(`trades/${id}/`);
export const createTrade = (payload) => axios.post('trades/', payload);
export const updateTrade = (id, payload) => axios.patch(`trades/${id}/`, payload);
export const deleteTrade = (id) => axios.delete(`trades/${id}/`);

export const prefillFromLicense = (params) =>
    axios.get('trades/prefill-from-license/', {params});
