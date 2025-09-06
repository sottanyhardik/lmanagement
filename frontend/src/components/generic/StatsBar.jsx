// src/components/generic/StatsBar.jsx
import React from "react";
import {Form} from "react-bootstrap";

const StatsBar = ({
                      totalLoaded = 0,
                      groupCount = 0,
                      selectedCount = 0,
                      allExpanded = true,
                      onToggleExpand = () => {
                      },
                  }) => (
    <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between mb-2">
        <div className="small text-muted">
            <strong>{totalLoaded}</strong> loaded · <strong>{groupCount}</strong> groups ·{" "}
            <strong>{selectedCount}</strong> selected
        </div>

        <Form.Check
            type="switch"
            id="expand-collapse-switch"
            label={allExpanded ? "Collapse All" : "Expand All"}
            checked={allExpanded}
            onChange={onToggleExpand}
            disabled={groupCount === 0 || totalLoaded === 0}
            className="small"
        />
    </div>
);

export default StatsBar;
