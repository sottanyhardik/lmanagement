import React from 'react';

const LoadMoreSection = ({loading, hasMore, onManualLoadMore, loadMoreRef}) => {
    return (
        <>
            {loading && (
                <div className="text-center my-3">
                    <div className="spinner-border text-primary" role="status"/>
                </div>
            )}
            {!loading && hasMore && (
                <>
                    <div className="d-flex justify-content-center">
                        <button className="btn btn-outline-primary btn-sm" onClick={onManualLoadMore}>
                            Load more
                        </button>
                    </div>
                    <div ref={loadMoreRef} className="text-center my-3" style={{minHeight: 24}}/>
                </>
            )}
        </>
    );
};

export default LoadMoreSection;
