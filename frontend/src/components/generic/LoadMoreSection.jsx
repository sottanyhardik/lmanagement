// src/components/generic/LoadMoreSection.jsx
import React from "react";
import {Button} from "react-bootstrap";

const LoadMoreSection = ({loading, hasMore, onManualLoadMore, loadMoreRef}) => (
    <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: 40}}>
        {loading && <div className="spinner-border text-primary" role="status"/>}

        {!loading && hasMore && (
            <Button size="sm" variant="outline-primary" onClick={onManualLoadMore}>
                Load more
            </Button>
        )}
    </div>
);

export default LoadMoreSection;
