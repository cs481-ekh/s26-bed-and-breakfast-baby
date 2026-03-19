import React, { useEffect, useState, useCallback } from 'react';
import './main_dash.css';

export default function MainDash() {
    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Assign-bed modal state
    const [assignTarget, setAssignTarget] = useState(null);
    const [availableBeds, setAvailableBeds] = useState([]);
    const [parolees, setParolees] = useState([]);
    const [selectedBed, setSelectedBed] = useState('');
    const [selectedParolee, setSelectedParolee] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState('');
    const [assigning, setAssigning] = useState(false);

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

    useEffect(() => {
        fetchAvailability();
    }, [fetchAvailability]);

    const openAssignModal = useCallback(async (facility) => {
        setAssignTarget(facility);
        setSelectedBed('');
        setSelectedParolee('');
        setModalError('');
        setModalLoading(true);
        try {
            const [bedsRes, paroleesRes] = await Promise.all([
                fetch(`/api/facilities/${facility.facility_id}/beds/`),
                fetch('/api/parolees/'),
            ]);
            const [bedsData, paroleesData] = await Promise.all([
                bedsRes.json(),
                paroleesRes.json(),
            ]);
            if (!bedsRes.ok) throw new Error('Could not load available beds.');
            if (!paroleesRes.ok) throw new Error('Could not load parolees.');
            setAvailableBeds(Array.isArray(bedsData) ? bedsData : []);
            setParolees(Array.isArray(paroleesData) ? paroleesData : []);
        } catch (err) {
            setModalError(err.message || 'Failed to load assignment data.');
        } finally {
            setModalLoading(false);
        }
    }, []);

    const closeModal = useCallback(() => {
        setAssignTarget(null);
        setAvailableBeds([]);
        setParolees([]);
        setSelectedBed('');
        setSelectedParolee('');
        setModalError('');
    }, []);

    const handleAssign = useCallback(async (e) => {
        e.preventDefault();
        if (!selectedBed || !selectedParolee) {
            setModalError('Please select both a bed and a parolee.');
            return;
        }
        setAssigning(true);
        setModalError('');
        try {
            const response = await fetch(`/api/beds/${selectedBed}/assign/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parolee_id: selectedParolee }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Assignment failed.');
            closeModal();
            fetchAvailability();
        } catch (err) {
            setModalError(err.message || 'Assignment failed.');
        } finally {
            setAssigning(false);
        }
    }, [selectedBed, selectedParolee, closeModal, fetchAvailability]);

    return (
        <section className="main-dash" aria-label="Main bed dashboard">
            <div className="main-dash-header">
                <h2>Facility Bed Availability</h2>
                <p>Live view of available beds by housing facility.</p>
            </div>

            {loading && <p className="main-dash-status">Loading facilities...</p>}
            {!loading && error && <p className="main-dash-status error">{error}</p>}

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
                            {facilities.map((facility) => (
                                <tr key={facility.facility_id}>
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
                                            className="assign-bed-btn"
                                            disabled={facility.available_beds === 0}
                                            onClick={() => openAssignModal(facility)}
                                        >
                                            Assign Bed
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {assignTarget && (
                <div className="modal-backdrop" role="presentation" onClick={closeModal}>
                    <div
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 id="modal-title">Assign Bed — {assignTarget.facility_name}</h3>

                        {modalLoading && <p className="modal-status">Loading…</p>}
                        {modalError && <p className="modal-status error">{modalError}</p>}

                        {!modalLoading && (
                            <form onSubmit={handleAssign}>
                                <label htmlFor="bed-select">Available Bed</label>
                                <select
                                    id="bed-select"
                                    value={selectedBed}
                                    onChange={(e) => setSelectedBed(e.target.value)}
                                    disabled={availableBeds.length === 0}
                                >
                                    <option value="">
                                        {availableBeds.length === 0 ? 'No beds available' : '— Select a bed —'}
                                    </option>
                                    {availableBeds.map((bed) => (
                                        <option key={bed.id} value={bed.id}>{bed.label}</option>
                                    ))}
                                </select>

                                <label htmlFor="parolee-select">Parolee</label>
                                <select
                                    id="parolee-select"
                                    value={selectedParolee}
                                    onChange={(e) => setSelectedParolee(e.target.value)}
                                    disabled={parolees.length === 0}
                                >
                                    <option value="">
                                        {parolees.length === 0 ? 'No unassigned parolees' : '— Select a parolee —'}
                                    </option>
                                    {parolees.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.idoc_id} — {p.last_name}, {p.first_name}
                                        </option>
                                    ))}
                                </select>

                                <div className="modal-actions">
                                    <button type="button" className="modal-cancel-btn" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="assign-bed-btn"
                                        disabled={assigning || !selectedBed || !selectedParolee}
                                    >
                                        {assigning ? 'Assigning…' : 'Confirm Assignment'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}