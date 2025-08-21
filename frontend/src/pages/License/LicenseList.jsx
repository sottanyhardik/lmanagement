// src/pages/License/LicenseList.jsx
import React from "react";
import {Card, Container} from "react-bootstrap";
import * as XLSX from "xlsx";
import axios from "../../api/axiosInstance";

import ListControls from "../../components/ListControls";
import DeleteSelectedButton from "./DeleteSelectedButton";
import LicenseFilters from "./LicenseFilters";
import LicenseForm from "./LicenseForm";
import GroupedAccordionLicense from "./GroupedAccordionLicense";

import useListManager from "../../hooks/License/useLicenseListManager";
import {groupLicensesAsObject} from "../../utils/License/groupLicenses";

// 🔹 helper for Biscuit report export
const exportBiscuitReport = async (statusFlag) => {
    try {
        const res = await axios.get(`licenses/biscuit-report/GE/${statusFlag}/`);
        const data = res.data || [];

        if (data.length === 0) {
            alert(`No data found for Biscuit Report (${statusFlag})`);
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "BiscuitReport");
        XLSX.writeFile(wb, `biscuit_report_${statusFlag}.xlsx`);
    } catch (err) {
        console.error("Error exporting biscuit report:", err);
        alert("Failed to download Biscuit Report");
    }
};

const LicenseList = () => {
    const {
        // data/state
        entries,
        expanded,
        setExpanded,
        loading,
        hasMore,
        newEntry,
        setNewEntry,
        allExpanded,
        setAllExpanded,

        // selection
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        clearSelection,

        // sorting/search/filtering
        sortField,
        sortOrder,
        setSortField,
        setSortOrder,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        setPage,

        // fetching / export / update
        loadMoreRef,
        updateSingleEntry,
        handleReset,
        handleExportXLSX,
        handleExportPDF,
        fetchData,
    } = useListManager("licenses/");

    const onAddNewClick = () =>
        setNewEntry({
            license_number: "",
            license_date: "",
            license_expiry_date: "",
            exporter: null,
            port: null,
            import_license: [],
            export_license: [],
        });

    const onSavedEntry = (id /* , updatedEntry */) => {
        updateSingleEntry(id);
        setExpanded((prev) => ({...prev, [id]: true}));
    };

    const grouped = groupLicensesAsObject(entries);

    return (
        <Container className="mt-4">
            <ListControls
                title="📜 Licenses"
                search={searchQuery}
                setSearch={setSearchQuery}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={setSortField}
                setSortOrder={setSortOrder}
                sortOptions={[
                    {label: "License No", value: "license_number"},
                    {label: "Date", value: "license_date"},
                    {label: "Expiry", value: "license_expiry_date"},
                    {label: "Recently Modified", value: "modified_on"},
                ]}
                Filters={<LicenseFilters filters={filters} setFilters={setFilters}/>}
                handleReset={handleReset}
                setPage={setPage}
                handleExportCSV={handleExportXLSX}
                handleExportPDF={handleExportPDF}
                onAddNewClick={onAddNewClick}
            />

            {/* 🔹 Biscuit Report Section */}
            <div className="my-3 p-3 border rounded bg-light">
                <h6 className="mb-2">Download Biscuit Report</h6>
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-sm btn-success"
                        onClick={() => exportBiscuitReport("live")}
                    >
                        Biscuit Live
                    </button>
                    <button
                        className="btn btn-sm btn-danger"
                        onClick={() => exportBiscuitReport("expired")}
                    >
                        Biscuit Expired
                    </button>
                </div>
            </div>

            <DeleteSelectedButton
                selectedIds={selectedIds}
                onDeleted={() => {
                    clearSelection();
                    fetchData(false, 1);
                }}
            />

            {newEntry && (
                <Card className="mb-3 border-success">
                    <Card.Header className="bg-success text-white">New License</Card.Header>
                    <Card.Body>
                        <LicenseForm
                            entry={newEntry}
                            isNew
                            onClose={() => setNewEntry(null)}
                            onSaved={() => {
                                setNewEntry(null);
                                fetchData(false, 1);
                            }}
                        />
                    </Card.Body>
                </Card>
            )}

            <GroupedAccordionLicense
                groups={grouped}
                allExpanded={allExpanded}
                expanded={expanded}
                toggle={(id) => setExpanded((prev) => ({...prev, [id]: !prev[id]}))}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                onSaved={onSavedEntry}
            />

            {loading && (
                <div className="text-center my-3">
                    <div className="spinner-border text-primary" role="status"/>
                </div>
            )}

            {!loading && hasMore && (
                <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: 24}}/>
            )}
        </Container>
    );
};

export default LicenseList;
