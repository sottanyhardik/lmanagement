// src/components/generic/StatsBar.jsx
import React from "react";
import {Button} from "react-bootstrap";

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
        <Button
            size="sm"
            variant="outline-primary"
            onClick={onToggleExpand}
            aria-label="Toggle expand all"
        >
            {allExpanded ? "Collapse All" : "Expand All"}
        </Button>
    </div>
);

export default StatsBar;
