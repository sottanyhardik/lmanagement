
// utils/parseFormErrors.js
export function parseFormErrors(errorResponse) {
    const errorData = errorResponse?.response?.data || {};
    const parsedErrors = {};

    for (const key in errorData) {
        const value = errorData[key];

        if (Array.isArray(value) && typeof value[0] === 'string') {
            parsedErrors[key] = value[0];
        }

        if (Array.isArray(value) && typeof value[0] === 'object') {
            value.forEach((item, index) => {
                for (const subKey in item) {
                    parsedErrors[`${key}[${index}].${subKey}`] = item[subKey][0];
                }
            });
        }
    }

    return parsedErrors;
}
