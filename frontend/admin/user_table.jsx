import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

const UserTable = forwardRef((props, ref) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:8000/api/users/');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setUsers(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        fetchUsers,
    }));

    if (loading) {
        return <div className="user-table-container"><p>Loading users...</p></div>;
    }

    if (error) {
        return (
            <div className="user-table-container">
                <p className="error">Error loading users: {error}</p>
                <button onClick={fetchUsers}>Retry</button>
            </div>
        );
    }

    return (
        <div className="user-table-container">
            <h2>Users</h2>
            {users.length === 0 ? (
                <p>No users found.</p>
            ) : (
                <table className="user-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>{`${user.first_name} ${user.last_name}`.trim() || 'N/A'}</td>
                                <td>{user.email}</td>
                                <td>{user.phone || 'N/A'}</td>
                                <td>{user.role}</td>
                                <td>{user.is_active ? 'Active' : 'Inactive'}</td>
                                <td>{new Date(user.date_joined).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <button onClick={fetchUsers}>Refresh</button>
        </div>
    );
});

UserTable.displayName = 'UserTable';

export default UserTable;
