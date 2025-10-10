import React from 'react';
import {Badge} from 'react-bootstrap';

const StatsBar = ({totalLoaded, groupCount, selectedCount, allExpanded, onToggleExpand}) => {
    return (
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex align-items-center gap-2">
                <Badge bg="primary">Loaded: {totalLoaded}</Badge>
                <Badge bg="secondary">Groups: {groupCount}</Badge>
                <Badge bg={selectedCount ? 'warning' : 'light'} text={selectedCount ? 'dark' : 'muted'}>
                    Selected: {selectedCount}
                </Badge>
            </div>

            {/* Expand/Collapse form-switch */}
            <div className="form-check form-switch">
                <input
                    className="form-check-input"
                    type="checkbox"
                    id="expandAllSwitch"
                    checked={allExpanded}
                    onChange={onToggleExpand}
                />
                <label className="form-check-label" htmlFor="expandAllSwitch">
                    {allExpanded ? 'Expanded' : 'Collapsed'}
                </label>
            </div>
        </div>
    );
};

export default StatsBar;
