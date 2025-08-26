import React from 'react';
import {Card} from 'react-bootstrap';
import BillOfEntryForm from '../BillOfEntryForm';

const NewEntryCard = ({newEntry, onClose, onSaved}) => {
    if (!newEntry) return null;
    return (
        <Card className="mb-3 border-success">
            <Card.Header className="bg-success text-white">New Bill of Entry</Card.Header>
            <Card.Body>
                <BillOfEntryForm entry={newEntry} isNew onClose={onClose} onSaved={onSaved}/>
            </Card.Body>
        </Card>
    );
};

export default NewEntryCard;
