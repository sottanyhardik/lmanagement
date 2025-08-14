// src/pages/License/LicenseList.jsx
import React from 'react';
import {Card, Container} from 'react-bootstrap';

import ListControls from '../../components/ListControls';
import DeleteSelectedButton from './DeleteSelectedButton';
import LicenseFilters from './LicenseFilters';
import LicenseForm from './LicenseForm';
import GroupedAccordionLicense from './GroupedAccordionLicense';

import useListManager from '../../hooks/License/useLicenseListManager';
import {groupLicensesAsObject} from '../../utils/License/groupLicenses';

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
    } = useListManager('licenses/');

    const onAddNewClick = () =>
        setNewEntry({
            license_number: '',
            license_date: '',
            license_expiry_date: '',
            exporter: null,
            port: null,
            import_license: [],
            export_license: [],
        });

    const onSavedEntry = (id /*, updatedEntry */) => {
        // fetch the fresh row and expand it
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
                    {label: 'License No', value: 'license_number'},
                    {label: 'Date', value: 'license_date'},
                    {label: 'Expiry', value: 'license_expiry_date'},
                    {label: 'Recently Modified', value: 'modified_on'},
                ]}
                Filters={<LicenseFilters filters={filters} setFilters={setFilters}/>}
                handleReset={handleReset}
                setPage={setPage}
                // Export actions
                handleExportCSV={handleExportXLSX}
                handleExportPDF={handleExportPDF}
                onAddNewClick={onAddNewClick}
            />

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

            {/* Loading indicator */}
            {loading && (
                <div className="text-center my-3">
                    <div className="spinner-border text-primary" role="status"/>
                </div>
            )}

            {/* Infinite-scroll sentinel (only when useful) */}
            {!loading && hasMore && (
                <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: 24}}/>
            )}
        </Container>
    );
};

export default LicenseList;
