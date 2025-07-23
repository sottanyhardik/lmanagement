// src/components/PaginationControls.jsx
import React from 'react';
import {Button} from 'react-bootstrap';

const PaginationControls = ({page, totalPages, setPage, loading}) => {
    if (loading || totalPages <= 1) return null;

    return (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
            <Button
                variant="outline-primary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((prev) => prev - 1)}
            >
                ← Previous
            </Button>
            <span className="fw-medium">
                Page {page} of {totalPages}
            </span>
            <Button
                variant="outline-primary"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => prev + 1)}
            >
                Next →
            </Button>
        </div>
    );
};

export default PaginationControls;
