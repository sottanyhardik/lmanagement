// src/components/PaginationControls.jsx
import React, {useMemo, useState} from 'react';
import {Button, Form, InputGroup, Pagination} from 'react-bootstrap';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function buildPageItems(current, total, maxButtons = 7) {
    if (total <= maxButtons) {
        return Array.from({length: total}, (_, i) => i + 1);
    }
    const siblings = Math.max(1, Math.floor((maxButtons - 3) / 2)); // room for 1, ..., ..., total
    const showLeft = current - siblings > 2;
    const showRight = current + siblings < total - 1;

    const start = showLeft ? current - siblings : 2;
    const end = showRight ? current + siblings : total - 1;

    const pages = [1];
    if (showLeft) pages.push('left-ellipsis');
    for (let p = start; p <= end; p++) pages.push(p);
    if (showRight) pages.push('right-ellipsis');
    pages.push(total);
    return pages;
}

export default function PaginationControls({
                                               page,
                                               totalPages,
                                               setPage,
                                               loading,
                                               maxButtons = 7,
                                               showJump = true,
                                           }) {
    if (loading || totalPages <= 1) return null;

    const items = useMemo(
        () => buildPageItems(page, totalPages, maxButtons),
        [page, totalPages, maxButtons]
    );

    const goTo = (p) => setPage(clamp(p, 1, totalPages));

    const [jumpVal, setJumpVal] = useState(String(page));
    // keep input synced when page changes externally
    React.useEffect(() => setJumpVal(String(page)), [page]);

    return (
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mt-4">
            <Pagination size="sm" className="mb-0">
                <Pagination.First
                    disabled={page === 1 || loading}
                    onClick={() => goTo(1)}
                    aria-label="First page"
                />
                <Pagination.Prev
                    disabled={page === 1 || loading}
                    onClick={() => goTo(page - 1)}
                    aria-label="Previous page"
                />

                {items.map((it, idx) =>
                    typeof it === 'number' ? (
                        <Pagination.Item
                            key={it}
                            active={it === page}
                            aria-current={it === page ? 'page' : undefined}
                            onClick={() => goTo(it)}
                            disabled={loading}
                        >
                            {it}
                        </Pagination.Item>
                    ) : (
                        <Pagination.Ellipsis key={it + '-' + idx} disabled/>
                    )
                )}

                <Pagination.Next
                    disabled={page === totalPages || loading}
                    onClick={() => goTo(page + 1)}
                    aria-label="Next page"
                />
                <Pagination.Last
                    disabled={page === totalPages || loading}
                    onClick={() => goTo(totalPages)}
                    aria-label="Last page"
                />
            </Pagination>

            <span className="fw-medium">Page {page} of {totalPages}</span>

            {showJump && (
                <InputGroup size="sm" style={{width: 160}}>
                    <InputGroup.Text>Go to</InputGroup.Text>
                    <Form.Control
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpVal}
                        onChange={(e) => setJumpVal(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const n = Number(jumpVal);
                                if (!Number.isNaN(n)) goTo(n);
                            }
                        }}
                        disabled={loading}
                    />
                    <Button
                        variant="outline-primary"
                        onClick={() => {
                            const n = Number(jumpVal);
                            if (!Number.isNaN(n)) goTo(n);
                        }}
                        disabled={loading}
                    >
                        Go
                    </Button>
                </InputGroup>
            )}
        </div>
    );
}
