import {useCallback, useState} from 'react';

const useAccordionToggle = () => {
    const [expanded, setExpanded] = useState({});

    const toggle = useCallback(
        id => setExpanded(prev => ({...prev, [id]: !prev[id]})),
        []
    );

    const collapseAll = useCallback(() => setExpanded({}), []);
    const expandAll = useCallback(ids =>
            setExpanded(Object.fromEntries(ids.map(id => [id, true]))),
        []
    );

    return {expanded, toggle, setExpanded, collapseAll, expandAll};
};

export default useAccordionToggle;
