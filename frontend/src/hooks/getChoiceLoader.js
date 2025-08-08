// getChoiceLoader.js
export function getChoiceLoader(choices, key) {
    return async (inputValue, callback) => {
        const group = choices?.[key] || [];
        const filtered = group.filter(opt =>
            opt.label.toLowerCase().includes(inputValue.toLowerCase())
        );
        callback(filtered);
    };
}
