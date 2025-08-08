import Select from 'react-select';
import {useLicenseChoices} from '../hooks/useChoiceLoader';

function findOption(value, options) {
    if (!value || !options) return null;

    if (typeof value === 'string') {
        return options.find(opt => opt.value === value) || {value, label: value};
    }

    if (Array.isArray(value)) {
        return value.map(v =>
            typeof v === 'string'
                ? options.find(opt => opt.value === v) || {value: v, label: v}
                : options.find(opt => opt.value === v?.value) || v
        ).filter(Boolean);
    }

    return options.find(opt => opt.value === value?.value) || value;
}

export default function ChoiceSelect({
                                         choiceKey,
                                         value,
                                         onChange,
                                         isMulti = false,
                                         ...props
                                     }) {
    const {choices, loading} = useLicenseChoices();
    const options = choices?.[choiceKey] || [];

    const resolvedValue = findOption(value, options);

    const handleSelectChange = (selected) => {
        onChange?.(selected);
    };

    if (loading) return <div>Loading choices for {choiceKey}...</div>;

    return (
        <Select
            options={options}
            value={resolvedValue}
            onChange={handleSelectChange}
            isMulti={isMulti}
            classNamePrefix="react-select"
            className="underline-select"
            placeholder={`Select ${choiceKey.replace(/_/g, ' ')}`}
            {...props}
        />
    );
}
