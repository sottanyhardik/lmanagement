import React, {useState} from "react";
import {Button, ButtonGroup} from "react-bootstrap";

export default function LedgerPage() {
    const [mode, setMode] = useState("license"); // 'license' | 'company'
    return (
        <div className="card">
            <div className="card-header bg-white d-flex align-items-center justify-content-between">
                <h5 className="mb-0">Ledger</h5>
                <ButtonGroup size="sm">
                    <Button
                        variant={mode === "license" ? "primary" : "outline-primary"}
                        onClick={() => setMode("license")}
                    >
                        License-wise
                    </Button>
                    <Button
                        variant={mode === "company" ? "primary" : "outline-primary"}
                        onClick={() => setMode("company")}
                    >
                        Company-wise
                    </Button>
                </ButtonGroup>
            </div>
            <div className="card-body">
                {/* TODO: add filters / table based on mode */}
                <div className="text-muted">Ledger ({mode}) will appear here.</div>
            </div>
        </div>
    );
}
