// src/components/generic/NewEntryCard.jsx
import React, {Suspense} from "react";
import {Card} from "react-bootstrap";

const Fallback = () => (
    <div className="py-3 text-center text-muted">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"/>
        Loading…
    </div>
);

const NewEntryCard = ({title = "New Entry", Editor, editorProps = {}, onClose, onSaved}) => {
    if (!Editor) return null;
    return (
        <Card className="mb-3 border-success">
            <Card.Header className="bg-success text-white">{title}</Card.Header>
            <Card.Body>
                <Suspense fallback={<Fallback/>}>
                    <Editor
                        {...editorProps}
                        isNew
                        onClose={onClose}
                        onSaved={onSaved}
                    />
                </Suspense>
            </Card.Body>
        </Card>
    );
};

export default NewEntryCard;
