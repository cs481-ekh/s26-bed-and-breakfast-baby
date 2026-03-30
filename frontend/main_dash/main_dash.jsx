import React, { useEffect, useState, useCallback } from 'react';
import './main_dash.css';

export default function MainDash() {
    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [parolees, setParolees] = useState([]);
    const [expandedFacilityId, setExpandedFacilityId] = useState(null);
    const [bedsByFacility, setBedsByFacility] = useState({});
    const [bedsLoadingByFacility, setBedsLoadingByFacility] = useState({});
    const [bedsErrorByFacility, setBedsErrorByFacility] = useState({});
    const [selectedParoleeByBed, setSelectedParoleeByBed] = useState({});
    const [expandedNotesByBed, setExpandedNotesByBed] = useState({});
    const [editingBedId, setEditingBedId] = useState(null);
    const [noteDraft, setNoteDraft] = useState('');
    const [processingBedId, setProcessingBedId] = useState(null);
    const [resetting, setResetting] = useState(false);

    const fetchAvailability = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/facilities/availability/');
            const payload = await response.json();
            if (!response.ok) throw new Error('Could not load bed availability.');
            setFacilities(Array.isArray(payload) ? payload : []);
            setError('');
        } catch (fetchError) {
            setError(fetchError.message || 'Could not load bed availability.');
            setFacilities([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchParolees = useCallback(async () => {
        try {
            const response = await fetch('/api/parolees/');
            const payload = await response.json();
            if (!response.ok) throw new Error('Could not load parolees.');
            setParolees(Array.isArray(payload) ? payload : []);
        } catch (fetchError) {
            setError(fetchError.message || 'Could not load parolees.');
            setParolees([]);
        }
    }, []);

    const fetchFacilityBeds = useCallback(async (facilityId) => {
        setBedsLoadingByFacility((prev) => ({ ...prev, [facilityId]: true }));
        setBedsErrorByFacility((prev) => ({ ...prev, [facilityId]: '' }));

        try {
            const response = await fetch(`/api/facilities/${facilityId}/beds/`);
            const payload = await response.json();
            if (!response.ok) throw new Error('Could not load beds for facility.');
            setBedsByFacility((prev) => ({
                ...prev,
                [facilityId]: Array.isArray(payload) ? payload : [],
            }));
        } catch (fetchError) {
            setBedsErrorByFacility((prev) => ({
                ...prev,
                [facilityId]: fetchError.message || 'Could not load beds for facility.',
            }));
            setBedsByFacility((prev) => ({ ...prev, [facilityId]: [] }));
        } finally {
            setBedsLoadingByFacility((prev) => ({ ...prev, [facilityId]: false }));
        }
    }, []);

    useEffect(() => {
        fetchAvailability();
        fetchParolees();
    }, [fetchAvailability, fetchParolees]);

    const handleToggleBeds = useCallback(async (facilityId) => {
        if (expandedFacilityId === facilityId) {
            setExpandedFacilityId(null);
            return;
        }

        setExpandedFacilityId(facilityId);
        if (!bedsByFacility[facilityId]) {
            await fetchFacilityBeds(facilityId);
        }
    }, [expandedFacilityId, bedsByFacility, fetchFacilityBeds]);

    const handleAssignBed = useCallback(async (bed, facility) => {
        const selectedParolee = selectedParoleeByBed[bed.id];
        if (!selectedParolee) {
            setError('Please select a parolee before assigning a bed.');
            return;
        }

        setProcessingBedId(bed.id);
        setError('');
        setSuccessMessage('');

        try {
            const selectedParoleeData = parolees.find((p) => String(p.id) === String(selectedParolee));
            const response = await fetch(`/api/beds/${bed.id}/assign/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parolee_id: selectedParolee }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Assignment failed.');

            const bedLabel = bed.label || `Bed ${bed.id}`;
            const facilityName = facility.facility_name || 'Unknown facility';
            const paroleeName = selectedParoleeData
                ? `${selectedParoleeData.last_name}, ${selectedParoleeData.first_name}`
                : 'Unknown parolee';
            const paroleeId = selectedParoleeData?.idoc_id || selectedParolee;

            setSuccessMessage(
                `Assigned ${bedLabel} at ${facilityName} to ${paroleeName} (ID: ${paroleeId}).`
            );

            setSelectedParoleeByBed((prev) => ({ ...prev, [bed.id]: '' }));
            await Promise.all([
                fetchAvailability(),
                fetchParolees(),
                fetchFacilityBeds(facility.facility_id),
            ]);
        } catch (err) {
            setError(err.message || 'Assignment failed.');
        } finally {
            setProcessingBedId(null);
        }
    }, [
        parolees,
        selectedParoleeByBed,
        fetchAvailability,
        fetchParolees,
        fetchFacilityBeds,
    ]);

    const handleUnassignBed = useCallback(async (bed, facility) => {
        setProcessingBedId(bed.id);
        setError('');
        setSuccessMessage('');

        try {
            const response = await fetch(`/api/beds/${bed.id}/unassign/`, {
                method: 'POST',
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Unassignment failed.');
            }

            const bedLabel = bed.label || `Bed ${bed.id}`;
            const facilityName = facility.facility_name || 'Unknown facility';
            setSuccessMessage(`Unassigned ${bedLabel} at ${facilityName}.`);

            await Promise.all([
                fetchAvailability(),
                fetchParolees(),
                fetchFacilityBeds(facility.facility_id),
            ]);
        } catch (requestError) {
            setError(requestError.message || 'Unassignment failed.');
        } finally {
            setProcessingBedId(null);
        }
    }, [fetchAvailability, fetchParolees, fetchFacilityBeds]);

    const renderBedStatus = useCallback((status) => {
        if (!status) return 'Unknown';
        return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }, []);

    const renderTimestamp = useCallback((isoTimestamp) => {
        if (!isoTimestamp) return 'Unknown';
        const date = new Date(isoTimestamp);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        return date.toLocaleString();
    }, []);

    const getNoteEntries = useCallback((notes) => {
        if (!notes) return [];
        return notes
            .split('\n')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .reverse();
    }, []);

    const parseNoteEntry = useCallback((entry) => {
        const match = entry.match(/^\[(.+?)\]\s*(.*)$/);
        if (!match) {
            return { timestamp: null, message: entry };
        }
        return {
            timestamp: match[1],
            message: match[2] || '',
        };
    }, []);

    const buildNotesTooltip = useCallback((bed) => {
        const updatedBy = bed.updated_by || 'System';
        const updatedAt = renderTimestamp(bed.updated_at);
        return `Last updated by ${updatedBy} on ${updatedAt}`;
    }, [renderTimestamp]);

    const handleStartEditNotes = useCallback((bed) => {
        setEditingBedId(bed.id);
        setNoteDraft(bed.notes || '');
    }, []);

    const handleCancelEditNotes = useCallback(() => {
        setEditingBedId(null);
        setNoteDraft('');
    }, []);

    const handleToggleNoteHistory = useCallback((bedId) => {
        setExpandedNotesByBed((prev) => ({
            ...prev,
            [bedId]: !prev[bedId],
        }));
    }, []);

    const handleSaveNotes = useCallback(async (bed, facility) => {
        setProcessingBedId(bed.id);
        setError('');
        setSuccessMessage('');

        try {
            const response = await fetch(`/api/beds/${bed.id}/notes/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: noteDraft }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to update notes.');
            }

            const bedLabel = bed.label || `Bed ${bed.id}`;
            const facilityName = facility.facility_name || 'Unknown facility';
            setSuccessMessage(`Updated notes for ${bedLabel} at ${facilityName}.`);
            setEditingBedId(null);
            setNoteDraft('');
            setExpandedNotesByBed((prev) => ({ ...prev, [bed.id]: false }));

            await fetchFacilityBeds(facility.facility_id);
        } catch (requestError) {
            setError(requestError.message || 'Failed to update notes.');
        } finally {
            setProcessingBedId(null);
        }
    }, [noteDraft, fetchFacilityBeds]);

    const handleUnassignAllBeds = useCallback(async () => {
        const confirmed = window.confirm(
            'This will unassign every currently assigned bed. Continue?'
        );
        if (!confirmed) {
            return;
        }

        setResetting(true);
        setError('');
        setSuccessMessage('');
        try {
            const response = await fetch('/api/beds/unassign-all/', {
                method: 'POST',
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Could not unassign all beds.');
            }
            setSuccessMessage(
                `Cleared assignments for ${payload.parolees_unassigned ?? 0} parolee(s) and reset ${payload.beds_reset ?? 0} bed(s).`
            );
            setBedsByFacility({});
            setExpandedFacilityId(null);
            await Promise.all([fetchAvailability(), fetchParolees()]);
        } catch (requestError) {
            setError(requestError.message || 'Could not unassign all beds.');
        } finally {
            setResetting(false);
        }
    }, [fetchAvailability, fetchParolees]);

    return (
        <section className="main-dash" aria-label="Main bed dashboard">
            <div className="main-dash-header">
                <h2>Facility Bed Availability</h2>
                <p>Click a facility to view beds and assign parolees one bed at a time.</p>
                <button
                    type="button"
                    className="unassign-all-btn"
                    onClick={handleUnassignAllBeds}
                    disabled={resetting}
                >
                    {resetting ? 'Clearing Assignments...' : 'Unassign All Beds'}
                </button>
            </div>

            {loading && <p className="main-dash-status">Loading facilities...</p>}
            {!loading && error && <p className="main-dash-status error">{error}</p>}
            {!loading && !error && successMessage && (
                <p className="main-dash-status success">{successMessage}</p>
            )}

            {!loading && !error && facilities.length === 0 && (
                <p className="main-dash-status">No facilities found.</p>
            )}

            {!loading && !error && facilities.length > 0 && (
                <div className="main-dash-table-wrap">
                    <table className="main-dash-table">
                        <thead>
                            <tr>
                                <th>Facility</th>
                                <th>Provider</th>
                                <th>District</th>
                                <th>Tier</th>
                                <th>Total Beds</th>
                                <th>Assigned Beds</th>
                                <th>Available Beds</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {facilities.map((facility) => {
                                const facilityBeds = bedsByFacility[facility.facility_id] || [];
                                const isExpanded = expandedFacilityId === facility.facility_id;
                                const isBedsLoading = Boolean(bedsLoadingByFacility[facility.facility_id]);
                                const bedsError = bedsErrorByFacility[facility.facility_id] || '';

                                return (
                                    <React.Fragment key={facility.facility_id}>
                                        <tr className={isExpanded ? 'facility-row expanded' : 'facility-row'}>
                                            <td>{facility.facility_name}</td>
                                            <td>{facility.provider_name}</td>
                                            <td>
                                                {facility.district_number} - {facility.district_name}
                                            </td>
                                            <td>{facility.tier.replace('_', ' ')}</td>
                                            <td>{facility.total_beds}</td>
                                            <td>{facility.assigned_beds}</td>
                                            <td>{facility.available_beds}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="assign-bed-btn"
                                                    onClick={() => handleToggleBeds(facility.facility_id)}
                                                >
                                                    {isExpanded ? 'Hide Beds' : 'View Beds'}
                                                </button>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr className="facility-bed-row">
                                                <td colSpan={8}>
                                                    {isBedsLoading && (
                                                        <p className="main-dash-status">Loading beds...</p>
                                                    )}

                                                    {!isBedsLoading && bedsError && (
                                                        <p className="main-dash-status error">{bedsError}</p>
                                                    )}

                                                    {!isBedsLoading && !bedsError && facilityBeds.length === 0 && (
                                                        <p className="main-dash-status">No beds found in this facility.</p>
                                                    )}

                                                    {!isBedsLoading && !bedsError && facilityBeds.length > 0 && (
                                                        <table className="facility-bed-table" aria-label={`${facility.facility_name} beds`}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Bed Number</th>
                                                                    <th>Current Status</th>
                                                                    <th>Notes</th>
                                                                    <th>Last Updated</th>
                                                                    <th>Last Updated By</th>
                                                                    <th>Assignment</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {facilityBeds.map((bed) => {
                                                                    const isAssignable = bed.status === 'available';
                                                                    const isOccupied = bed.status === 'occupied';
                                                                    const isProcessing = processingBedId === bed.id;
                                                                    const isEditingNotes = editingBedId === bed.id;
                                                                    const canEditNotes = Boolean(bed.can_edit_notes);
                                                                    const selectedParolee = selectedParoleeByBed[bed.id] || '';
                                                                    const allNoteEntries = getNoteEntries(bed.notes);
                                                                    const isHistoryExpanded = Boolean(expandedNotesByBed[bed.id]);
                                                                    const visibleNoteEntries = isHistoryExpanded
                                                                        ? allNoteEntries
                                                                        : allNoteEntries.slice(0, 3);
                                                                    const hasMoreHistory = allNoteEntries.length > 3;

                                                                    return (
                                                                        <tr key={bed.id}>
                                                                            <td>{bed.label}</td>
                                                                            <td>
                                                                                <span className={`bed-status ${bed.status}`}>
                                                                                    {renderBedStatus(bed.status)}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                {!isEditingNotes && (
                                                                                    <div className="bed-notes-view">
                                                                                        {allNoteEntries.length === 0 && (
                                                                                            <span className="bed-notes-text" title={buildNotesTooltip(bed)}>
                                                                                                None
                                                                                            </span>
                                                                                        )}

                                                                                        {allNoteEntries.length > 0 && (
                                                                                            <ul className="bed-notes-list" title={buildNotesTooltip(bed)}>
                                                                                                {visibleNoteEntries.map((entry, index) => {
                                                                                                    const parsed = parseNoteEntry(entry);
                                                                                                    return (
                                                                                                        <li key={`${bed.id}-${index}`} className="bed-notes-item">
                                                                                                            {parsed.timestamp && (
                                                                                                                <span className="bed-note-timestamp">{parsed.timestamp}</span>
                                                                                                            )}
                                                                                                            <span className="bed-note-message">
                                                                                                                {parsed.message || entry}
                                                                                                            </span>
                                                                                                        </li>
                                                                                                    );
                                                                                                })}
                                                                                            </ul>
                                                                                        )}

                                                                                        {canEditNotes && hasMoreHistory && (
                                                                                            <div className="note-history-controls">
                                                                                                <span className="note-history-meta">
                                                                                                    {`Showing ${visibleNoteEntries.length} of ${allNoteEntries.length} changes`}
                                                                                                </span>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="note-history-toggle-btn"
                                                                                                    onClick={() => handleToggleNoteHistory(bed.id)}
                                                                                                    disabled={isProcessing}
                                                                                                >
                                                                                                    {isHistoryExpanded ? 'Show less' : 'Show full history'}
                                                                                                </button>
                                                                                            </div>
                                                                                        )}

                                                                                        {canEditNotes && (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="note-edit-btn"
                                                                                                onClick={() => handleStartEditNotes(bed)}
                                                                                                disabled={isProcessing}
                                                                                            >
                                                                                                Edit
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                )}

                                                                                {isEditingNotes && (
                                                                                    <div className="bed-notes-editor">
                                                                                        <textarea
                                                                                            value={noteDraft}
                                                                                            onChange={(e) => setNoteDraft(e.target.value)}
                                                                                            rows={3}
                                                                                            disabled={isProcessing}
                                                                                        />
                                                                                        <div className="bed-notes-actions">
                                                                                            <button
                                                                                                type="button"
                                                                                                className="assign-bed-btn"
                                                                                                onClick={() => handleSaveNotes(bed, facility)}
                                                                                                disabled={isProcessing}
                                                                                            >
                                                                                                {isProcessing ? 'Saving...' : 'Save'}
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                className="note-cancel-btn"
                                                                                                onClick={handleCancelEditNotes}
                                                                                                disabled={isProcessing}
                                                                                            >
                                                                                                Cancel
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td>{renderTimestamp(bed.updated_at)}</td>
                                                                            <td>{bed.updated_by || 'System'}</td>
                                                                            <td>
                                                                                <div className="bed-assign-controls">
                                                                                    <select
                                                                                        value={selectedParolee}
                                                                                        onChange={(e) => setSelectedParoleeByBed((prev) => ({
                                                                                            ...prev,
                                                                                            [bed.id]: e.target.value,
                                                                                        }))}
                                                                                        disabled={!isAssignable || parolees.length === 0 || isProcessing}
                                                                                    >
                                                                                        <option value="">
                                                                                            {parolees.length === 0 ? 'No unassigned parolees' : 'Select parolee'}
                                                                                        </option>
                                                                                        {parolees.map((p) => (
                                                                                            <option key={p.id} value={p.id}>
                                                                                                {p.idoc_id} - {p.last_name}, {p.first_name}
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="assign-bed-btn"
                                                                                        disabled={!isAssignable || !selectedParolee || isProcessing}
                                                                                        onClick={() => handleAssignBed(bed, facility)}
                                                                                    >
                                                                                        {isProcessing && isAssignable ? 'Assigning...' : 'Assign'}
                                                                                    </button>

                                                                                    {isOccupied && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="unassign-bed-btn"
                                                                                            disabled={isProcessing}
                                                                                            onClick={() => handleUnassignBed(bed, facility)}
                                                                                        >
                                                                                            {isProcessing ? 'Unassigning...' : 'Unassign'}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}