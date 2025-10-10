import React from "react";
import {Button, Spinner} from "react-bootstrap";

const AllottedHeader = ({itemsCount, deletingAll, onRemoveAll}) => (
    <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Allotted Items</h6>
        <Button
            size="sm"
            variant="outline-danger"
            disabled={deletingAll || itemsCount === 0}
            onClick={onRemoveAll}
        >
            {deletingAll ? (
                <>
                    <Spinner size="sm" className="me-1"/> Removing…
                </>
            ) : (
                "Remove All"
            )}
        </Button>
    </div>
);

export default AllottedHeader;
