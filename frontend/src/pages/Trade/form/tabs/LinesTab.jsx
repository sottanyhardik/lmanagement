import React from "react";
import TradeLinesTable from "../../TradeLinesTable";

export default function LinesTab({rows, setRows, direction, boeId, errors}) {
    return (
        <TradeLinesTable
            rows={rows}
            setRows={setRows}
            direction={direction}
            boeId={boeId}
            errors={errors}
        />
    );
}
