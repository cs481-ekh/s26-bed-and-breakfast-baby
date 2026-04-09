import React, { useEffect, useState, useCallback } from 'react';
import { apiJson } from '../src/apiClient';
import './main_dash.css';

export default function MainDash({ readOnly = false }) {
    const [facilities, setFacilities] = useState([]);
    const [facilityCatalog, setFacilityCatalog] = useState([]);
    const [facilityCatalogLoaded, setFacilityCatalogLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDistricts, setSelectedDistricts] = useState([]);
    const [selectedGenderTargets, setSelectedGenderTargets] = useState([]);
    const [selectedSOBedTargets, setSelectedSOBedTargets] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Bed-level interaction state for expanded rows and in-row actions.
    const [parolees, setParolees] = useState([]);
    const [expandedFacilityId, setExpandedFacilityId] = useState(null);
    const [bedsByFacility, setBedsByFacility] = useState({});
    const [bedsLoadingByFacility, setBedsLoadingByFacility] = useState({});
    const [bedsErrorByFacility, setBedsErrorByFacility] = useState({});
    const [selectedParoleeByBed, setSelectedParoleeByBed] = useState({});
    const [paroleeSearchByBed, setParoleeSearchByBed] = useState({});
    const [paroleeDropdownOpenByBed, setParoleeDropdownOpenByBed] = useState({});
    const [editingBedId, setEditingBedId] = useState(null);
    const [noteDraft, setNoteDraft] = useState('');
    const [processingBedId, setProcessingBedId] = useState(null);
    const [resetting, setResetting] = useState(false);
    const [expandedNotesBedIds, setExpandedNotesBedIds] = useState(new Set());

    // Notes modal state for viewing notes in a popup.
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [selectedBedForNotesModal, setSelectedBedForNotesModal] = useState(null);

    const buildAvailabilityUrl = useCallback((districtKeys = [], genderTargets = [], soBedTargets = []) => {
        const params = new URLSearchParams();

        districtKeys.forEach((districtKey) => {
            const districtNumber = String(districtKey).split('|')[0];
            if (districtNumber) {
                params.append('district', districtNumber);
            }
        });

        genderTargets.forEach((targetValue) => {
            if (targetValue === 'male_centered') {
                params.append('gender', 'male');
            }
            if (targetValue === 'female_centered') {
                params.append('gender', 'female');
            }
            if (targetValue === 'either') {
                params.append('gender', 'either');
            }
        });

        soBedTargets.forEach((targetValue) => {
            if (targetValue === 'has_so_beds') {
                params.append('so_beds', 'has');
            }
            if (targetValue === 'no_so_beds') {
                params.append('so_beds', 'none');
            }
        });

        const queryString = params.toString();
        return queryString ? `/api/facilities/availability/?${queryString}` : '/api/facilities/availability/';
    }, []);

    // Facility summary fetch powers the top-level facility table.
    const fetchAvailability = useCallback(async ({ districtKeys = [], genderTargets = [], soBedTargets = [], refreshCatalog = false } = {}) => {
        try {
            setLoading(true);
            const response = await fetch(buildAvailabilityUrl(districtKeys, genderTargets, soBedTargets));
            const payload = await response.json();
            if (!response.ok) throw new Error('Could not load bed availability.');
            if (refreshCatalog) {
                setFacilityCatalog(Array.isArray(payload) ? payload : []);
                setFacilityCatalogLoaded(true);
            }
            setFacilities(Array.isArray(payload) ? payload : []);
            setError('');
        } catch (fetchError) {
            setError(fetchError.message || 'Could not load bed availability.');
            setFacilities([]);
        } finally {
            setLoading(false);
        }
    }, [buildAvailabilityUrl]);

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

    // Initial load keeps facility totals and parolee choices in sync.
    useEffect(() => {
        fetchAvailability({ refreshCatalog: true });
        fetchParolees();
    }, [fetchAvailability, fetchParolees]);

    // Refetch availability when facility-level filters change.
    useEffect(() => {
        if (!facilityCatalogLoaded) {
            return;
        }

        fetchAvailability({
            districtKeys: selectedDistricts,
            genderTargets: selectedGenderTargets,
            soBedTargets: selectedSOBedTargets,
        });
    }, [facilityCatalogLoaded, fetchAvailability, selectedDistricts, selectedGenderTargets, selectedSOBedTargets]);

    // Build district filter options from the currently loaded facilities.
    const districtOptions = (facilityCatalog.length > 0 ? facilityCatalog : facilities)
        .reduce((acc, facility) => {
            const key = `${facility.district_number}|${facility.district_name}`;
            if (!acc.some((option) => option.key === key)) {
                acc.push({
                    key,
                    district_number: facility.district_number,
                    district_name: facility.district_name,
                });
            }
            return acc;
        }, [])
        .sort((a, b) => Number(a.district_number) - Number(b.district_number));

    // Supports quoted phrases with AND/OR logic, e.g. "Location A" AND "Location B".
    const parseSearchExpression = useCallback((rawSearchInput) => {
        const trimmedInput = rawSearchInput.trim();
        if (!trimmedInput) {
            return { terms: [], operators: [] };
        }

        const tokenRegex = /"([^"]+)"|\b(AND|OR)\b/gi;
        const parsedTerms = [];
        const parsedOperators = [];
        let hasQuotedTerms = false;
        let tokenMatch;

        while ((tokenMatch = tokenRegex.exec(trimmedInput)) !== null) {
            const [, quotedTerm, logicalOperator] = tokenMatch;
            if (quotedTerm) {
                const cleanedTerm = quotedTerm.trim();
                if (cleanedTerm) {
                    parsedTerms.push(cleanedTerm);
                    hasQuotedTerms = true;
                }
                continue;
            }

            if (logicalOperator && parsedTerms.length > parsedOperators.length) {
                parsedOperators.push(logicalOperator.toUpperCase());
            }
        }

        if (!hasQuotedTerms) {
            return { terms: [trimmedInput], operators: [] };
        }

        while (parsedOperators.length > Math.max(parsedTerms.length - 1, 0)) {
            parsedOperators.pop();
        }

        return { terms: parsedTerms, operators: parsedOperators };
    }, []);

    const parsedSearchExpression = parseSearchExpression(searchTerm);

    const matchesSearchExpression = useCallback((facility, parsedExpression) => {
        if (parsedExpression.terms.length === 0) {
            return true;
        }

        const searchableText = `${facility.facility_name || ''} ${facility.provider_name || ''}`.toLowerCase();
        const termResults = parsedExpression.terms.map((term) => searchableText.includes(term.toLowerCase()));

        let aggregate = termResults[0];
        for (let index = 1; index < termResults.length; index += 1) {
            const operator = parsedExpression.operators[index - 1] || 'AND';
            aggregate = operator === 'OR'
                ? aggregate || termResults[index]
                : aggregate && termResults[index];
        }

        return aggregate;
    }, []);

    const searchedFacilities = parsedSearchExpression.terms.length === 0
        ? facilities
        : facilities.filter((facility) => matchesSearchExpression(facility, parsedSearchExpression));

    const toggleDistrictFilter = useCallback((districtKey) => {
        setSelectedDistricts((prev) => (
            prev.includes(districtKey)
                ? prev.filter((key) => key !== districtKey)
                : [...prev, districtKey]
        ));
    }, []);

    const clearAllFilters = useCallback(() => {
        setSearchTerm('');
        setSelectedDistricts([]);
        setSelectedGenderTargets([]);
        setSelectedSOBedTargets([]);
    }, []);

    const toggleFiltersMenu = useCallback(() => {
        setFiltersOpen((prev) => !prev);
    }, []);

    const genderTargetOptions = [
        { value: 'male_centered', label: 'Male-only' },
        { value: 'female_centered', label: 'Female-only' },
        { value: 'either', label: 'Gender neutral' },
    ];

    const toggleGenderTargetFilter = useCallback((targetValue) => {
        setSelectedGenderTargets((prev) => (
            prev.includes(targetValue)
                ? prev.filter((value) => value !== targetValue)
                : [...prev, targetValue]
        ));
    }, []);

    const soBedFilterOptions = [
        { value: 'has_so_beds', label: 'Has S/O beds' },
        { value: 'no_so_beds', label: 'No S/O beds' },
    ];

    const toggleSOBedFilter = useCallback((targetValue) => {
        setSelectedSOBedTargets((prev) => (
            prev.includes(targetValue)
                ? prev.filter((value) => value !== targetValue)
                : [...prev, targetValue]
        ));
    }, []);

    const hasActiveFilters = searchTerm.trim() !== ''
        || selectedDistricts.length > 0
        || selectedGenderTargets.length > 0
        || selectedSOBedTargets.length > 0;

    const escapeRegex = useCallback((value) => (
        value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ), []);

    const renderSearchMatch = useCallback((text) => {
        const rawText = text || '';
        if (parsedSearchExpression.terms.length === 0) return rawText;

        const uniqueTerms = [...new Set(parsedSearchExpression.terms.map((term) => term.trim()).filter(Boolean))]
            .sort((left, right) => right.length - left.length);
        if (uniqueTerms.length === 0) return rawText;

        const escapedPattern = uniqueTerms.map((term) => escapeRegex(term)).join('|');
        const splitRegex = new RegExp(`(${escapedPattern})`, 'ig');
        const exactRegex = new RegExp(`^(?:${escapedPattern})$`, 'i');
        const parts = rawText.split(splitRegex);

        return parts.map((part, index) => {
            if (!part) return null;
            if (exactRegex.test(part)) {
                return (
                    <mark key={`${rawText}-${index}`} className="search-match">
                        {part}
                    </mark>
                );
            }
            return <React.Fragment key={`${rawText}-${index}`}>{part}</React.Fragment>;
        });
    }, [parsedSearchExpression, escapeRegex]);

    const filterParolees = useCallback((searchValue) => {
        const normalizedSearch = (searchValue || '').trim().toLowerCase();
        if (!normalizedSearch) {
            return parolees;
        }

        return parolees.filter((parolee) => {
            const paroleeNumber = (parolee.idoc_id || '').toLowerCase();
            const paroleeFirstName = (parolee.first_name || '').toLowerCase();
            const paroleeLastName = (parolee.last_name || '').toLowerCase();
            const fullName = `${paroleeFirstName} ${paroleeLastName}`;
            const reverseFullName = `${paroleeLastName} ${paroleeFirstName}`;
            return paroleeNumber.includes(normalizedSearch)
                || fullName.includes(normalizedSearch)
                || reverseFullName.includes(normalizedSearch);
        });
    }, [parolees]);

    const formatParoleeLabel = useCallback((parolee) => (
        `${parolee.idoc_id} - ${parolee.last_name}, ${parolee.first_name}`
    ), []);

    const handleParoleeSearchChange = useCallback((bedId, searchValue) => {
        setParoleeSearchByBed((prev) => ({
            ...prev,
            [bedId]: searchValue,
        }));

        setParoleeDropdownOpenByBed((prev) => ({
            ...prev,
            [bedId]: true,
        }));

        setSelectedParoleeByBed((prev) => {
            const currentSelected = prev[bedId];
            if (!currentSelected) {
                return prev;
            }

            const nextMatches = filterParolees(searchValue);
            const stillVisible = nextMatches.some((parolee) => String(parolee.id) === String(currentSelected));
            if (stillVisible) {
                return prev;
            }

            return {
                ...prev,
                [bedId]: '',
            };
        });
    }, [filterParolees]);

    const handleOpenParoleeDropdown = useCallback((bedId) => {
        setParoleeDropdownOpenByBed((prev) => ({
            ...prev,
            [bedId]: true,
        }));
    }, []);

    const handleCloseParoleeDropdown = useCallback((bedId) => {
        setTimeout(() => {
            setParoleeDropdownOpenByBed((prev) => ({
                ...prev,
                [bedId]: false,
            }));
        }, 120);
    }, []);

    const handleSelectParolee = useCallback((bedId, parolee) => {
        setSelectedParoleeByBed((prev) => ({
            ...prev,
            [bedId]: String(parolee.id),
        }));
        setParoleeSearchByBed((prev) => ({
            ...prev,
            [bedId]: formatParoleeLabel(parolee),
        }));
        setParoleeDropdownOpenByBed((prev) => ({
            ...prev,
            [bedId]: false,
        }));
    }, [formatParoleeLabel]);

    // Expand/collapse a single facility row and lazily load its beds.
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

    // Assign selected parolee to one specific bed row.
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
            const { response, payload } = await apiJson(`/api/beds/${bed.id}/assign/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parolee_id: selectedParolee }),
            });
            if (!response.ok) throw new Error(payload?.error || 'Assignment failed.');

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

    // Shared release action for both occupied beds and held beds.
    const handleUnassignBed = useCallback(async (bed, facility) => {
        setProcessingBedId(bed.id);
        setError('');
        setSuccessMessage('');

        try {
            const { response, payload } = await apiJson(`/api/beds/${bed.id}/unassign/`, {
                method: 'POST',
            });
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

    // Request a hold reservation for a selected parolee on an available bed.
    const handleHoldBed = useCallback(async (bed, facility) => {
        const selectedParolee = selectedParoleeByBed[bed.id];
        if (!selectedParolee) {
            setError('Please select a parolee before requesting a hold.');
            return;
        }

        setProcessingBedId(bed.id);
        setError('');
        setSuccessMessage('');

        try {
            const { response, payload } = await apiJson(`/api/beds/${bed.id}/hold/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parolee_id: selectedParolee }),
            });
            if (!response.ok) {
                throw new Error(payload.error || 'Hold request failed.');
            }

            const bedLabel = bed.label || `Bed ${bed.id}`;
            const facilityName = facility.facility_name || 'Unknown facility';
            setSuccessMessage(`Placed hold on ${bedLabel} at ${facilityName}.`);
            setSelectedParoleeByBed((prev) => ({ ...prev, [bed.id]: '' }));

            await Promise.all([
                fetchAvailability(),
                fetchParolees(),
                fetchFacilityBeds(facility.facility_id),
            ]);
        } catch (requestError) {
            setError(requestError.message || 'Hold request failed.');
        } finally {
            setProcessingBedId(null);
        }
    }, [selectedParoleeByBed, fetchAvailability, fetchParolees, fetchFacilityBeds]);

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

    // Notes are stored as newline-delimited history entries; newest shown first.
    const getNoteEntries = useCallback((notes) => {
        if (!notes) return [];
        return notes
            .split('\n')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .reverse();
    }, []);

    // Parse optional "[timestamp] message" note format for structured rendering.
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

    // Admin inline editor entry point for a single bed note history.
    const handleStartEditNotes = useCallback((bed) => {
        setEditingBedId(bed.id);
        setNoteDraft(bed.notes || '');
    }, []);

    const handleCancelEditNotes = useCallback(() => {
        setEditingBedId(null);
        setNoteDraft('');
    }, []);

    // Notes modal handlers.
    const handleCloseNotesModal = useCallback(() => {
        setNotesModalOpen(false);
        setSelectedBedForNotesModal(null);
    }, []);

    const handleToggleNoteHistory = useCallback((bedId) => {
        setExpandedNotesBedIds((prev) => {
            const next = new Set(prev);
            if (next.has(bedId)) {
                next.delete(bedId);
            } else {
                next.add(bedId);
            }
            return next;
        });
    }, []);

    // Save an admin note edit and refresh only the currently expanded facility.
    const handleSaveNotes = useCallback(async (bed, facility) => {
        setProcessingBedId(bed.id);
        setError('');
        setSuccessMessage('');

        try {
            const { response, payload } = await apiJson(`/api/beds/${bed.id}/notes/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: noteDraft }),
            });
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to update notes.');
            }

            const bedLabel = bed.label || `Bed ${bed.id}`;
            const facilityName = facility.facility_name || 'Unknown facility';
            setSuccessMessage(`Updated notes for ${bedLabel} at ${facilityName}.`);
            setEditingBedId(null);
            setNoteDraft('');

            await fetchFacilityBeds(facility.facility_id);
        } catch (requestError) {
            setError(requestError.message || 'Failed to update notes.');
        } finally {
            setProcessingBedId(null);
        }
    }, [noteDraft, fetchFacilityBeds]);

    // Demo/testing reset to clear all assignments and refresh dashboard counts.
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
            const { response, payload } = await apiJson('/api/beds/unassign-all/', {
                method: 'POST',
            });
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

                <div className="main-dash-controls">
                    <label htmlFor="facility-search" className="main-dash-search-label">Search</label>
                    <input
                        id="facility-search"
                        type="search"
                        className="main-dash-search-input"
                        placeholder="Search facilities or providers"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        aria-label="Search facilities or providers"
                    />

                    <button
                        type="button"
                        className="filters-toggle-btn"
                        onClick={toggleFiltersMenu}
                        aria-expanded={filtersOpen}
                        aria-controls="facility-filters-panel"
                    >
                        {filtersOpen ? 'Hide Filters' : 'Filters'}
                    </button>

                    <button
                        type="button"
                        className="clear-all-filters-btn"
                        onClick={clearAllFilters}
                        disabled={!hasActiveFilters}
                    >
                        Clear All Filters
                    </button>
                </div>

                {filtersOpen && (
                    <div id="facility-filters-panel" className="filters-menu" aria-label="Facility filters menu">
                        <div className="filters-menu-header">
                            <p className="filters-menu-title">Filters</p>
                        </div>

                        {districtOptions.length > 0 && (
                            <div className="district-filter" aria-label="Facility district filters">
                                <p className="district-filter-title">Districts</p>
                                <div className="district-filter-options">
                                    {districtOptions.map((option) => (
                                        <label key={option.key} className="district-filter-option">
                                            <input
                                                type="checkbox"
                                                checked={selectedDistricts.includes(option.key)}
                                                onChange={() => toggleDistrictFilter(option.key)}
                                            />
                                            <span>{option.district_number} - {option.district_name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="gender-filter" aria-label="Facility gender target filters">
                            <p className="gender-filter-title">Gender Targets</p>
                            <div className="gender-filter-options">
                                {genderTargetOptions.map((option) => (
                                    <label key={option.value} className="gender-filter-option">
                                        <input
                                            type="checkbox"
                                            checked={selectedGenderTargets.includes(option.value)}
                                            onChange={() => toggleGenderTargetFilter(option.value)}
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="gender-filter" aria-label="Facility sex offender bed filters">
                            <p className="gender-filter-title">Sex Offender Beds</p>
                            <div className="gender-filter-options">
                                {soBedFilterOptions.map((option) => (
                                    <label key={option.value} className="gender-filter-option">
                                        <input
                                            type="checkbox"
                                            checked={selectedSOBedTargets.includes(option.value)}
                                            onChange={() => toggleSOBedFilter(option.value)}
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

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

            {!loading && !error && searchedFacilities.length === 0 && (
                <p className="main-dash-status">No facilities found.</p>
            )}

            {!loading && !error && searchedFacilities.length > 0 && (
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
                                {!readOnly && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {searchedFacilities.map((facility) => {
                                const facilityBeds = bedsByFacility[facility.facility_id] || [];
                                const isExpanded = expandedFacilityId === facility.facility_id;
                                const isBedsLoading = Boolean(bedsLoadingByFacility[facility.facility_id]);
                                const bedsError = bedsErrorByFacility[facility.facility_id] || '';

                                return (
                                    <React.Fragment key={facility.facility_id}>
                                        <tr className={isExpanded ? 'facility-row expanded' : 'facility-row'}>
                                            <td>
                                                <div className="facility-name-cell">
                                                    <span>{renderSearchMatch(facility.facility_name)}</span>
                                                    <span
                                                        className={facility.has_sex_offender_beds ? 'so-bed-badge has-so-beds' : 'so-bed-badge no-so-beds'}
                                                        aria-label={facility.has_sex_offender_beds ? 'Facility has S/O beds' : 'Facility has no S/O beds'}
                                                    >
                                                        {facility.has_sex_offender_beds ? 'S/O beds: Yes' : 'S/O beds: No'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{renderSearchMatch(facility.provider_name)}</td>
                                            <td>
                                                {facility.district_number} - {facility.district_name}
                                            </td>
                                            <td>{facility.tier.replace('_', ' ')}</td>
                                            <td>{facility.total_beds}</td>
                                            <td>{facility.assigned_beds}</td>
                                            <td>{facility.available_beds}</td>
                                            {!readOnly && (
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="assign-bed-btn"
                                                        onClick={() => handleToggleBeds(facility.facility_id)}
                                                    >
                                                        {isExpanded ? 'Hide Beds' : 'View Beds'}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>

                                        {isExpanded && (
                                            // Expanded facility details: per-bed status, notes, and actions.
                                            <tr className="facility-bed-row">
                                                <td colSpan={readOnly ? 7 : 8}>
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
                                                                    const isHeld = bed.status === 'held';
                                                                    const isProcessing = processingBedId === bed.id;
                                                                    const isEditingNotes = editingBedId === bed.id;
                                                                    const canEditNotes = Boolean(bed.can_edit_notes);
                                                                    const selectedParolee = selectedParoleeByBed[bed.id] || '';
                                                                    const paroleeSearchValue = paroleeSearchByBed[bed.id] || '';
                                                                    const isParoleeDropdownOpen = Boolean(paroleeDropdownOpenByBed[bed.id]);
                                                                    const filteredParolees = filterParolees(paroleeSearchValue);
                                                                    const allNoteEntries = getNoteEntries(bed.notes);

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
                                                                                            <span className="bed-notes-text">None</span>
                                                                                        )}

                                                                                        {allNoteEntries.length > 0 && (() => {
                                                                                            const isNotesExpanded = expandedNotesBedIds.has(bed.id);
                                                                                            const displayEntries = isNotesExpanded
                                                                                                ? allNoteEntries
                                                                                                : allNoteEntries.slice(0, 3);
                                                                                            return (
                                                                                                <>
                                                                                                    <ul className="bed-notes-list">
                                                                                                        {displayEntries.map((entry, idx) => {
                                                                                                            const parsed = parseNoteEntry(entry);
                                                                                                            return (
                                                                                                                <li key={idx} className="bed-notes-item">
                                                                                                                    <span className="bed-notes-message">{parsed.message || entry}</span>
                                                                                                                </li>
                                                                                                            );
                                                                                                        })}
                                                                                                    </ul>
                                                                                                    {allNoteEntries.length > 3 && (
                                                                                                        <>
                                                                                                            <span className="bed-notes-count">{`Showing ${displayEntries.length} of ${allNoteEntries.length} changes`}</span>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                className="notes-history-toggle-btn"
                                                                                                                onClick={() => handleToggleNoteHistory(bed.id)}
                                                                                                                disabled={isProcessing}
                                                                                                            >
                                                                                                                {isNotesExpanded ? 'Show less' : 'Show full history'}
                                                                                                            </button>
                                                                                                        </>
                                                                                                    )}
                                                                                                </>
                                                                                            );
                                                                                        })()}

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
                                                                            <td title={`Last updated by ${bed.updated_by || 'System'} on ${renderTimestamp(bed.updated_at)}`}>{renderTimestamp(bed.updated_at)}</td>
                                                                            <td>{bed.updated_by || 'System'}</td>
                                                                            <td>
                                                                                <div className="bed-assign-controls">
                                                                                    <div className="parolee-combobox">
                                                                                        <label
                                                                                            htmlFor={`parolee-search-${bed.id}`}
                                                                                            className="parolee-search-label"
                                                                                        >
                                                                                            Search parolees for {bed.label}
                                                                                        </label>
                                                                                        <input
                                                                                            id={`parolee-search-${bed.id}`}
                                                                                            type="search"
                                                                                            className="parolee-search-input"
                                                                                            placeholder="Search by number or name"
                                                                                            value={paroleeSearchValue}
                                                                                            onFocus={() => handleOpenParoleeDropdown(bed.id)}
                                                                                            onBlur={() => handleCloseParoleeDropdown(bed.id)}
                                                                                            onChange={(e) => handleParoleeSearchChange(bed.id, e.target.value)}
                                                                                            aria-expanded={isParoleeDropdownOpen}
                                                                                            aria-controls={`parolee-options-${bed.id}`}
                                                                                            disabled={!isAssignable || parolees.length === 0 || isProcessing}
                                                                                        />

                                                                                        {isParoleeDropdownOpen && !(!isAssignable || parolees.length === 0 || isProcessing) && (
                                                                                            <div
                                                                                                id={`parolee-options-${bed.id}`}
                                                                                                className="parolee-combobox-list"
                                                                                                role="listbox"
                                                                                                aria-label={`Parolee options for ${bed.label}`}
                                                                                            >
                                                                                                {filteredParolees.length === 0 ? (
                                                                                                    <div className="parolee-combobox-empty">
                                                                                                        No matches found
                                                                                                    </div>
                                                                                                ) : filteredParolees.map((parolee) => {
                                                                                                    const optionLabel = formatParoleeLabel(parolee);
                                                                                                    const isSelected = String(selectedParolee) === String(parolee.id);
                                                                                                    return (
                                                                                                        <button
                                                                                                            key={parolee.id}
                                                                                                            type="button"
                                                                                                            role="option"
                                                                                                            aria-selected={isSelected}
                                                                                                            className={isSelected ? 'parolee-combobox-option selected' : 'parolee-combobox-option'}
                                                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                                                            onClick={() => handleSelectParolee(bed.id, parolee)}
                                                                                                        >
                                                                                                            {optionLabel}
                                                                                                        </button>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="assign-bed-btn"
                                                                                        disabled={!isAssignable || !selectedParolee || isProcessing}
                                                                                        onClick={() => handleAssignBed(bed, facility)}
                                                                                    >
                                                                                        {isProcessing && isAssignable ? 'Assigning...' : 'Assign'}
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="hold-bed-btn"
                                                                                        disabled={!isAssignable || !selectedParolee || isProcessing}
                                                                                        onClick={() => handleHoldBed(bed, facility)}
                                                                                    >
                                                                                        {isProcessing && isAssignable ? 'Requesting...' : 'Request Hold'}
                                                                                    </button>

                                                                                    {(isOccupied || isHeld) && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="unassign-bed-btn"
                                                                                            disabled={isProcessing}
                                                                                            onClick={() => handleUnassignBed(bed, facility)}
                                                                                        >
                                                                                            {isProcessing
                                                                                                ? (isHeld ? 'Releasing...' : 'Unassigning...')
                                                                                                : (isHeld ? 'Release Hold' : 'Unassign')}
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

            {/* Notes Modal */}
            {notesModalOpen && selectedBedForNotesModal && (
                <div className="notes-modal-overlay" onClick={handleCloseNotesModal}>
                    <div className="notes-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="notes-modal-header">
                            <h3>Notes for Bed {selectedBedForNotesModal.label}</h3>
                            <button
                                type="button"
                                className="notes-modal-close-btn"
                                onClick={handleCloseNotesModal}
                                aria-label="Close notes modal"
                            >
                                ×
                            </button>
                        </div>
                        <div className="notes-modal-body">
                            {(() => {
                                const noteEntries = getNoteEntries(selectedBedForNotesModal.notes);
                                if (noteEntries.length === 0) {
                                    return <p className="notes-modal-empty">No notes</p>;
                                }
                                return (
                                    <ul className="notes-modal-list">
                                        {noteEntries.map((entry, index) => {
                                            const parsed = parseNoteEntry(entry);
                                            return (
                                                <li key={index} className="notes-modal-item">
                                                    {parsed.timestamp && (
                                                        <span className="notes-modal-timestamp">{parsed.timestamp}</span>
                                                    )}
                                                    <span className="notes-modal-message">{parsed.message || entry}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                );
                            })()}
                        </div>
                        <div className="notes-modal-footer">
                            <button
                                type="button"
                                className="notes-modal-close-btn-footer"
                                onClick={handleCloseNotesModal}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}