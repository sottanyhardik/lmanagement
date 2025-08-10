// src/pages/Allotment/MakeTLAsBOE.jsx
import React, {useEffect, useState} from 'react';
import {Card, Container} from 'react-bootstrap';
import {useParams} from 'react-router-dom';
import axios from '../../api/axiosInstance';
import TransferLetterForm from '../../pages/TransferLetter/TransferLetterForm'; // adjust path if needed

const MakeTLAsBOE = () => {
    const {id} = useParams(); // allotment id
    const [entry, setEntry] = useState(null);
    const [prefill, setPrefill] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const {data} = await axios.get(`/api/allotments/${id}/`);
                if (!mounted) return;
                setEntry(data);

                // Map allotment lines to TL line structure your TL form expects.
                // Commonly: license_item_id, qty, cif_fc, cif_inr, remarks, etc.
                const initialItems = (data.allotment_details || []).map((d) => ({
                    license_item_id: d.item?.id ?? null,
                    description: d.description,
                    hs_code: d.hs_code,
                    unit: d.unit,
                    qty: d.qty,
                    cif_fc: d.cif_fc,
                    cif_inr: d.cif_inr,
                    // add more if your TL form needs it…
                }));

                setPrefill({
                    reference_allotment_id: data.id,
                    company: data.company,      // show context in the header of TL form
                    port: data.port,
                    item_name: data.item_name,
                    required_quantity: data.required_quantity,
                    initialItems,
                });
            } catch (e) {
                console.error(e);
            }
        })();
        return () => (mounted = false);
    }, [id]);

    if (!entry || !prefill) return <Container className="py-4">
        <div className="spinner-border"/>
    </Container>;

    return (
        <Container className="py-4">
            <Card className="shadow-sm">
                <Card.Header className="bg-white">
                    <div className="fw-bold">Make Transfer Letter (BOE-style)</div>
                    <div className="small text-muted">
                        {entry.company?.name} • {entry.item_name} • Required {entry.required_quantity}
                    </div>
                </Card.Header>
                <Card.Body className="p-0">
                    {/* Your TL form renders a BOE-like table already;
             we just inject prefill to hydrate it. */}
                    <TransferLetterForm prefill={prefill}/>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default MakeTLAsBOE;
