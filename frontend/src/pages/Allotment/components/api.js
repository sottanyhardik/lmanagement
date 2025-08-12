// api.js
export const LICENSE_SEARCH_URL = "/api/license-import-items/select/";
export const ADD_DETAIL_URL = (id) => `/api/allotments/${id}/details/`;
export const DELETE_DETAIL_URL = (allotmentId, detailId) =>
    `/api/allotments/${allotmentId}/details/${detailId}/`;
