// src/pages/BillOfEntry/BillOfEntryList.jsx
import React from 'react';
import {Card, Container} from 'react-bootstrap';

import ListControls from '../../components/ListControls';
import DeleteSelectedButton from './DeleteSelectedButton';
import BoeFilters from './BoeFilters';
import BillOfEntryForm from './BillOfEntryForm';
import GroupedAccordion from './GroupedAccordion';

import {groupEntries} from '../../utils/groupEntries';
import useBillOfEntryListManager from '../../hooks/BillOfEntry/useBillOfEntryListManager';

const BillOfEntryList = () => {
    const {
        // data/state
        entries,
        loading,
        hasMore,
        expanded,
        setExpanded,
        allExpanded,
        setAllExpanded,
        newEntry,
        setNewEntry,

        // selection
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        clearSelection,

        // sorting/search/filtering
        sortField,
        sortOrder,
        sortOptions,
        setSortField,
        setSortOrder,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        setPage,

        // io
        loadMoreRef,
        updateSingleEntry,
        fetchData,
        handleReset,
        handleExportXLSX,
        handleExportPDF,
    } = useBillOfEntryListManager(); // hook baseURL already includes /api via axiosInstance

    const onAddNewClick = () =>
        setNewEntry({
            bill_of_entry_number: '',
            bill_of_entry_date: '',
            port: null,
            exchange_rate: '',
            company: null,
            invoice_no: '',
            product_name: '',
            item_details: [
                {
                    sr_number: '',
                    transaction_type: 'D', // Debit by default
                    qty: '',
                    cif_fc: '',
                    cif_inr: '',
                },
            ],
        });

    const onSavedRow = (id) => {
        if (!id) return;
        updateSingleEntry(id);
        setExpanded((prev) => ({...prev, [id]: true}));
    };

    const groups = groupEntries(entries);

    return (
        <Container className="mt-4">
            <ListControls
                title="📄 Bill of Entry"
                search={searchQuery}
                setSearch={setSearchQuery}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={setSortField}
                setSortOrder={setSortOrder}
                sortOptions={sortOptions}
                setPage={setPage}
                handleReset={handleReset}
                handleExportCSV={loading ? undefined : handleExportXLSX}
                handleExportPDF={loading ? undefined : handleExportPDF}
                dataExport
                Filters={<BoeFilters filters={filters} setFilters={setFilters}/>}
                onAddNewClick={onAddNewClick}
            />

            <DeleteSelectedButton
                selectedIds={selectedIds}
                onDeleted={() => {
                    clearSelection();
                    fetchData(false, 1);
                }}
            />

            <div className="d-flex justify-content-end mb-2">
                <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setAllExpanded((prev) => !prev)}
                >
                    {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
            </div>

            {newEntry && (
                <Card className="mb-3 border-success">
                    <Card.Header className="bg-success text-white">New Bill of Entry</Card.Header>
                    <Card.Body>
                        <BillOfEntryForm
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

            <GroupedAccordion
                groups={groups}
                allExpanded={allExpanded}
                expanded={expanded}
                toggle={(id) => setExpanded((prev) => ({...prev, [id]: !prev[id]}))}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                onSaved={onSavedRow}
            />

            {/* Loading + infinite-scroll sentinel */}
            {loading && (
                <div className="text-center my-3">
                    <div className="spinner-border text-primary" role="status"/>
                </div>
            )}
            {!loading && hasMore && (
                <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: 24}}/>
            )}
            {!loading && !entries.length && (
                <div className="text-center text-muted my-4">No entries found.</div>
            )}
        </Container>
    );
};

export default BillOfEntryList;
