import React, { useState } from 'react';

export default function AdminDash({ onAddUser, onRemoveUser, onDisableUser, onChangeRole }) {
    const [addForm, setAddForm] = useState({
        first_name: '',
        last_name: '',
        employee_id: '',
        email: '',
        password: '',
        confirm_password: '',
    });
    const [addErrors, setAddErrors] = useState({});
    const [addMessage, setAddMessage] = useState('');

    const [removeForm, setRemoveForm] = useState({ username: '' });
    const [roleForm, setRoleForm] = useState({ username: '', role: 'case_manager' });

    const validateAddForm = () => {
        const errors = {};

        if (!addForm.first_name.trim()) {
            errors.first_name = 'First name is required.';
        }
        if (!addForm.last_name.trim()) {
            errors.last_name = 'Last name is required.';
        }
        if (!addForm.employee_id.trim()) {
            errors.employee_id = 'Employee ID is required.';
        }
        if (!addForm.email.trim()) {
            errors.email = 'Email is required.';
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
            setAddForm({ first_name: '', last_name: '', employee_id: '', email: '', password: '', confirm_password: '' });
        } catch (error) {
            setAddErrors(error.fieldErrors || {});
            setAddMessage('Please fix the highlighted fields.');
        }
    };

    const handleRemoveSubmit = (e) => {
        e.preventDefault();
        const confirmed = window.confirm(
            `Are you sure you want to remove account "${removeForm.username}"? This action cannot be undone.`
        );
        if (!confirmed) {
            return;
        }
        if (onRemoveUser) onRemoveUser(removeForm.username);
        else console.log('Remove user', removeForm.username);
        setRemoveForm({ username: '' });
    };

    const handleDisableSubmit = (e) => {
        e.preventDefault();
        if (onDisableUser) onDisableUser(removeForm.username);
        else console.log('Disable user', removeForm.username);
        setRemoveForm({ username: '' });
    };

    const handleRoleSubmit = (e) => {
        e.preventDefault();
        if (onChangeRole) onChangeRole(roleForm.username, roleForm.role);
        else console.log('Change role', roleForm);
        setRoleForm({ username: '', role: 'case_manager' });
    };

    return (
        <div className="container">
            <h1>Sign Up</h1>
            <div className="options">
                <div className="option">
                    <h2>Create Account</h2>
                    <form onSubmit={handleAddSubmit}>
                        <input
                            type="text"
                            name="first_name"
                            placeholder="First Name"
                            required
                            value={addForm.first_name}
                            onChange={(e) => updateAddField('first_name', e.target.value)}
                        />
                        {addErrors.first_name && <div>{addErrors.first_name}</div>}
                        <input
                            type="text"
                            name="last_name"
                            placeholder="Last Name"
                            required
                            value={addForm.last_name}
                            onChange={(e) => updateAddField('last_name', e.target.value)}
                        />
                        {addErrors.last_name && <div>{addErrors.last_name}</div>}
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
                            type="email"
                            name="email"
                            placeholder="Email"
                            required
                            value={addForm.email}
                            onChange={(e) => updateAddField('email', e.target.value)}
                        />
                        {addErrors.email && <div>{addErrors.email}</div>}
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
                        {addMessage && <div>{addMessage}</div>}
                        <button type="submit">Sign Up</button>
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
                        <button type="button" onClick={handleDisableSubmit}>Disable Account</button>
                    </form>
                </div>

                <div className="option">
                    <h2>Change User Role</h2>
                    <form onSubmit={handleRoleSubmit}>
                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            required
                            value={roleForm.username}
                            onChange={(e) => setRoleForm({ ...roleForm, username: e.target.value })}
                        />
                        <select
                            name="role"
                            value={roleForm.role}
                            onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value })}
                        >
                            <option value="admin">Admin</option>
                            <option value="case_manager">Case Manager</option>
                            <option value="provider">Housing Provider</option>
                        </select>
                        <button type="submit">Update Role</button>
                    </form>
                </div>
            </div>
        </div>
    );
}
