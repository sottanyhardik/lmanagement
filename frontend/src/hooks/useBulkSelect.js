import {useState} from 'react';

export const useBulkSelect = () => {
    const [selectedIds, setSelectedIds] = useState([]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = (ids) => {
        const allSelected = ids.every(id => selectedIds.includes(id));
        setSelectedIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
    };

    const clearSelection = () => setSelectedIds([]);

    return {selectedIds, toggleSelect, toggleSelectAll, clearSelection};
};