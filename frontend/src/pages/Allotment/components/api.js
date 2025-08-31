// api.js
export const LICENSE_SEARCH_URL = "/license-import-items/select/";
export const ADD_DETAIL_URL = (id) => `/allotments/${id}/details/`;
export const DELETE_DETAIL_URL = (allotmentId, detailId) =>
    `/allotments/${allotmentId}/details/${detailId}/`;
