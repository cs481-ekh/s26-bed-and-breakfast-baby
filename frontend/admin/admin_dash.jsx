import React, { useState } from 'react';

export default function AdminDash({ onAddUser, onRemoveUser }) {
    const [addForm, setAddForm] = useState({
        name: '',
        employee_id: '',
        password: '',
        confirm_password: '',
        role: 'user',
    });
    const [addErrors, setAddErrors] = useState({});
    const [addMessage, setAddMessage] = useState('');

    const [removeForm, setRemoveForm] = useState({ username: '' });

    const validateAddForm = () => {
        const errors = {};

        if (!addForm.name.trim()) {
            errors.name = 'Name is required.';
        }
        if (!addForm.employee_id.trim()) {
            errors.employee_id = 'Employee ID is required.';
        }
        if (!addForm.password) {
            errors.password = 'Password is required.';
        }
        if (!addForm.confirm_password) {
            errors.confirm_password = 'Please confirm your password.';
        } else if (addForm.password !== addForm.confirm_password) {
            errors.confirm_password = 'Passwords do not match.';
        }

        return errors;
    };

    const updateAddField = (name, value) => {
        setAddForm({ ...addForm, [name]: value });
        if (addErrors[name]) {
            setAddErrors({ ...addErrors, [name]: '' });
        }
        if (addMessage) {
            setAddMessage('');
        }
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();

        const validationErrors = validateAddForm();
        if (Object.keys(validationErrors).length > 0) {
            setAddErrors(validationErrors);
            return;
        }

        try {
            setAddErrors({});
            if (onAddUser) {
                const payload = await onAddUser(addForm);
                setAddMessage('User created successfully. Redirecting...');
                window.location.assign(payload.redirect_to || '/');
            } else {
                console.log('Add user', addForm);
                setAddMessage('User created successfully. Redirecting...');
                window.location.assign('/');
            }
            setAddForm({ name: '', employee_id: '', password: '', confirm_password: '', role: 'user' });
        } catch (error) {
            setAddErrors(error.fieldErrors || {});
            setAddMessage('Please fix the highlighted fields.');
        }
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
                            onChange={(e) => updateAddField('name', e.target.value)}
                        />
                        {addErrors.name && <div>{addErrors.name}</div>}
                        <input
                            type="text"
                            name="employee_id"
                            placeholder="Employee ID"
                            required
                            value={addForm.employee_id}
                            onChange={(e) => updateAddField('employee_id', e.target.value)}
                        />
                        {addErrors.employee_id && <div>{addErrors.employee_id}</div>}
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            required
                            value={addForm.password}
                            onChange={(e) => updateAddField('password', e.target.value)}
                        />
                        {addErrors.password && <div>{addErrors.password}</div>}
                        <input
                            type="password"
                            name="confirm_password"
                            placeholder="Confirm Password"
                            required
                            value={addForm.confirm_password}
                            onChange={(e) => updateAddField('confirm_password', e.target.value)}
                        />
                        {addErrors.confirm_password && <div>{addErrors.confirm_password}</div>}
                        <label>
                            <input
                                name="role"
                                type="radio"
                                value="user"
                                checked={addForm.role === 'user'}
                                onChange={(e) => updateAddField('role', e.target.value)}
                            />{' '}
                            User
                        </label>
                        <label>
                            <input
                                name="role"
                                type="radio"
                                value="admin"
                                checked={addForm.role === 'admin'}
                                onChange={(e) => updateAddField('role', e.target.value)}
                            />{' '}
                            Admin
                        </label>
                        {addMessage && <div>{addMessage}</div>}
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
