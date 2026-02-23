import React, { useState } from 'react';

export default function AdminDash({ onAddUser, onRemoveUser }) {
    const [addForm, setAddForm] = useState({
        name: '',
        employee_id: '',
        password: '',
        confirm_password: '',
        role: 'user',
    });

    const [removeForm, setRemoveForm] = useState({ username: '' });

    const handleAddSubmit = (e) => {
        e.preventDefault();
        if (addForm.password !== addForm.confirm_password) {
            alert('Passwords do not match');
            return;
        }
        if (onAddUser) onAddUser(addForm);
        else console.log('Add user', addForm);
        setAddForm({ name: '', employee_id: '', password: '', confirm_password: '', role: 'user' });
    };

    const handleRemoveSubmit = (e) => {
        e.preventDefault();
        if (onRemoveUser) onRemoveUser(removeForm.username);
        else console.log('Remove user', removeForm.username);
        setRemoveForm({ username: '' });
    };

    return (
        <div className="container">
            <h1>Admin Dashboard</h1>
            <div className="options">
                <div className="option">
                    <h2>Add User</h2>
                    <form onSubmit={handleAddSubmit}>
                        <input
                            type="text"
                            name="name"
                            placeholder="Name"
                            required
                            value={addForm.name}
                            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        />
                        <input
                            type="text"
                            name="employee_id"
                            placeholder="Employee ID"
                            required
                            value={addForm.employee_id}
                            onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })}
                        />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            required
                            value={addForm.password}
                            onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                        />
                        <input
                            type="password"
                            name="confirm_password"
                            placeholder="Confirm Password"
                            required
                            value={addForm.confirm_password}
                            onChange={(e) => setAddForm({ ...addForm, confirm_password: e.target.value })}
                        />
                        <label>
                            <input
                                name="role"
                                type="radio"
                                value="user"
                                checked={addForm.role === 'user'}
                                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                            />{' '}
                            User
                        </label>
                        <label>
                            <input
                                name="role"
                                type="radio"
                                value="admin"
                                checked={addForm.role === 'admin'}
                                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                            />{' '}
                            Admin
                        </label>
                        <button type="submit">Add User</button>
                    </form>
                </div>

                <div className="option">
                    <h2>Remove User</h2>
                    <form onSubmit={handleRemoveSubmit}>
                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            required
                            value={removeForm.username}
                            onChange={(e) => setRemoveForm({ username: e.target.value })}
                        />
                        <button type="submit">Remove User</button>
                    </form>
                </div>
            </div>
        </div>
    );
}
