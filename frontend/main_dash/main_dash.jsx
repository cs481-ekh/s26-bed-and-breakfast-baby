import React, { useEffect, useState } from 'react';
import './main_dash.css';

export default function MainDash() {
    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchAvailability = async () => {
            try {
                const response = await fetch('/api/facilities/availability/');
                const payload = await response.json();

                if (!response.ok) {
                    throw new Error('Could not load bed availability.');
                }

                if (isMounted) {
                    setFacilities(Array.isArray(payload) ? payload : []);
                    setError('');
                }
            } catch (fetchError) {
                if (isMounted) {
                    setError(fetchError.message || 'Could not load bed availability.');
                    setFacilities([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchAvailability();

        return () => {
            isMounted = false;
        };
    }, []);

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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}