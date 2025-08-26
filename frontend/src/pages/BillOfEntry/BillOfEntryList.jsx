import React, {useMemo} from 'react';
import {Container} from 'react-bootstrap';

import ListControls from '../../components/ListControls';
import DeleteSelectedButton from './DeleteSelectedButton';
import BoeFilters from './BoeFilters';
import GroupedAccordion from './GroupedAccordion';

import {groupEntries} from '../../utils/groupEntries';
import useBillOfEntryListManager from '../../hooks/BillOfEntry/useBillOfEntryListManager';

import StatsBar from './components/StatsBar';
import FilterChips from './components/FilterChips';
import NewEntryCard from './components/NewEntryCard';
import LoadMoreSection from './components/LoadMoreSection';

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
    } = useBillOfEntryListManager();

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
                {sr_number: '', transaction_type: 'D', qty: '', cif_fc: '', cif_inr: ''},
            ],
        });

    const onSavedRow = (id) => {
        if (!id) return;
        updateSingleEntry(id);
        setExpanded((prev) => ({...prev, [id]: true}));
    };

    const groups = useMemo(() => groupEntries(entries), [entries]);
    const totalLoaded = entries.length;
    const groupCount = useMemo(() => Object.keys(groups || {}).length, [groups]);
    const selectedCount = selectedIds.length;

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

            <StatsBar
                totalLoaded={totalLoaded}
                groupCount={groupCount}
                selectedCount={selectedCount}
                allExpanded={allExpanded}
                onToggleExpand={() => setAllExpanded((prev) => !prev)}
            />

            <FilterChips filters={filters} setFilters={setFilters} onClearAll={handleReset}/>

            <DeleteSelectedButton
                selectedIds={selectedIds}
                onDeleted={() => {
                    clearSelection();
                    fetchData(false, 1);
                }}
            />

            <NewEntryCard
                newEntry={newEntry}
                onClose={() => setNewEntry(null)}
                onSaved={() => {
                    setNewEntry(null);
                    fetchData(false, 1);
                }}
            />

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

            <LoadMoreSection
                loading={loading}
                hasMore={hasMore}
                onManualLoadMore={() => setPage((p) => p + 1)}
                loadMoreRef={loadMoreRef}
            />

            {!loading && !entries.length && (
                <div className="text-center text-muted my-4">No entries found.</div>
            )}
        </Container>
    );
};

export default BillOfEntryList;
