import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiJson } from '../apiClient';
import './Header.css';

const ROLE_LABELS = {
  admin: 'Admin',
  case_manager: 'Case Manager',
  parole_officer: 'Parole Officer',
  provider: 'Provider',
};

export default function Header() {
  const location = useLocation();
  const [role, setRole] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      const { response, payload } = await apiJson('/api/me/');
      if (!cancelled && response.ok) {
        setRole(payload?.role || '');
      }
    };

    loadRole();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const roleLabel = useMemo(() => {
    if (!role) {
      return 'Guest';
    }
    return ROLE_LABELS[role] || role;
  }, [role]);

  const handleLogout = async () => {
    try {
      await apiJson('/api/auth/logout/', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  };

  const handleSettingsClick = () => {
    // TODO: Implement user settings menu
    console.log('Settings menu clicked');
  };

  // Determine current page to highlight active link
  const isMainDashboard = location.pathname === '/main-dashboard' || location.pathname === '/main-dashboard.html';
  const isAdminDashboard = location.pathname.includes('admin');
  const isProviderDashboard = location.pathname === '/provider-dashboard';

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo Section */}
        <div className="header-logo">
          <div className="logo-placeholder">IDOC</div>
        </div>

        {/* Navigation Section */}
        <nav className="header-nav">
          {role !== 'provider' && (
            <button
              className={`nav-link ${isMainDashboard ? 'active' : ''}`}
              onClick={() => window.location.assign('/main-dashboard')}
            >
              Main Dashboard
            </button>
          )}
          {role === 'admin' && (
            <button
              className={`nav-link ${isAdminDashboard ? 'active' : ''}`}
              onClick={() => window.location.assign('/admin')}
            >
              Admin Dashboard
            </button>
          )}
          {role === 'admin' && (
            <button
              className={`nav-link ${isProviderDashboard ? 'active' : ''}`}
              onClick={() => window.location.assign('/provider-dashboard')}
            >
              Housing Provider
              <span className="nav-test-badge">Test Quick Link</span>
            </button>
          )}
        </nav>

        {/* Right Actions Section */}
        <div className="header-actions">
          <span className="role-indicator" title="Temporary role label for testing">
            Role: {roleLabel}
          </span>
          <button
            className="header-button settings-button"
            onClick={handleSettingsClick}
            title="User settings"
            aria-label="Open user settings menu"
          >
            ⚙️
          </button>
          <button
            className="header-button logout-button"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
}
