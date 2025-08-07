import React from 'react';
import {Card, Container} from 'react-bootstrap';

import BillOfEntryForm from './BillOfEntryForm';
import ListControls from '../../components/ListControls';
import DeleteSelectedButton from './DeleteSelectedButton';
import GroupedAccordion from './GroupedAccordion';
import BoeFilters from './BoeFilters';
import {groupEntries} from '../../utils/groupEntries';
import useBillOfEntryListManager from '../../hooks/BillOfEntry/useBillOfEntryListManager';

const BillOfEntryList = () => {
    const {
        entries,
        expanded,
        loading,
        newEntry,
        allExpanded,
        selectedIds,
        sortField,
        sortOrder,
        searchQuery,
        filters,
        loadMoreRef,
        sortOptions,
        setSortField,
        setSortOrder,
        setSearchQuery,
        setPage,
        setNewEntry,
        toggleSelect,
        toggleSelectAll,
        clearSelection,
        setFilters,
        handleReset,
        handleExportXLSX,
        handleExportPDF,
        updateSingleEntry,
        fetchData,
        setAllExpanded
    } = useBillOfEntryListManager();

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
                dataExport={true}
                Filters={React.Children.toArray(<BoeFilters filters={filters} setFilters={setFilters}/>)}
                onAddNewClick={() =>
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
                                transaction_type: 'D',
                                qty: '',
                                cif_fc: '',
                                cif_inr: '',
                            },
                        ],
                    })
                }
            />

            <DeleteSelectedButton
                selectedIds={selectedIds}
                onDeleted={() => {
                    clearSelection();
                    fetchData();
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
                                fetchData();
                            }}
                        />
                    </Card.Body>
                </Card>
            )}

            <GroupedAccordion
                groups={groupEntries(entries)}
                allExpanded={allExpanded}
                expanded={expanded}
                toggle={(id) => setExpanded((prev) => ({...prev, [id]: !prev[id]}))}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                onSaved={updateSingleEntry}
            />

            <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: '40px'}}>
                {loading && <div className="spinner-border text-primary" role="status"/>}
                {!loading && !entries.length && <span className="text-muted">No entries found</span>}
            </div>
        </Container>
    );
};

export default BillOfEntryList;
