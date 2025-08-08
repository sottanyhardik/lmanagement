// pages/License/LicenseList.jsx
import React from 'react';
import {Card, Container} from 'react-bootstrap';
import LicenseForm from './LicenseForm';
import ListControls from '../../components/ListControls';
import DeleteSelectedButton from './DeleteSelectedButton';
import LicenseFilters from './LicenseFilters';
import useListManager from '../../hooks/License/useLicenseListManager';
import axios from '../../api/axiosInstance';
import GroupedAccordionLicense from './GroupedAccordionLicense';
import {groupLicenses} from '../../utils/License/groupLicenses';

const LicenseList = () => {
    const {
        entries,
        newEntry,
        setNewEntry,
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        updateSingleEntry,
        expanded,
        setExpanded,
        allExpanded,
        setAllExpanded,
        sortField,
        sortOrder,
        setSortField,
        setSortOrder,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        setPage,
        clearSelection,
        loadMoreRef,
        fetchData,
        handleReset,
    } = useListManager('/api/licenses/');

    const handleExport = async () => {
        try {
            const res = await axios.get('/api/licenses/export/', {responseType: 'blob'});
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'licenses_export.xlsx');
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            console.error('Export failed', err);
        }
    };

    const updateEntryInList = (id, updatedEntry) => {
        updateSingleEntry(id, updatedEntry); // update state
        setExpanded(prev => ({...prev, [id]: true})); // expand the updated entry
    };

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
                ]}
                Filters={React.Children.toArray(<LicenseFilters filters={filters} setFilters={setFilters}/>)}
                handleReset={handleReset}
                setPage={setPage}
                handleExportCSV={handleExport}
                onAddNewClick={() => setNewEntry({
                    license_number: '',
                    license_date: '',
                    license_expiry_date: '',
                    exporter: null,
                    port: null,
                    import_license: [],
                    export_license: []
                })}
            />

            <DeleteSelectedButton
                selectedIds={selectedIds}
                onDeleted={() => {
                    clearSelection();
                    fetchData();
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
                                fetchData();
                            }}
                        />
                    </Card.Body>
                </Card>
            )}

            <GroupedAccordionLicense
                groups={groupLicenses(entries)}
                allExpanded={allExpanded}
                expanded={expanded}
                toggle={(id) => setExpanded((prev) => ({...prev, [id]: !prev[id]}))}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                onSaved={updateEntryInList}
            />

            <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: '40px'}}>
                <div className="spinner-border text-primary" role="status"/>
            </div>
        </Container>
    );
};

export default LicenseList;
