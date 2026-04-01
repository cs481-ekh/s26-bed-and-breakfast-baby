import { useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    // TODO: Implement logout API call
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  const handleSettingsClick = () => {
    // TODO: Implement user settings menu
    console.log('Settings menu clicked');
  };

  // Determine current page to highlight active link
  const isMainDashboard = location.pathname === '/main-dashboard';
  const isAdminDashboard = location.pathname.includes('admin');

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo Section */}
        <div className="header-logo">
          <div className="logo-placeholder">IDOC</div>
        </div>

        {/* Navigation Section */}
        <nav className="header-nav">
          <button
            className={`nav-link ${isMainDashboard ? 'active' : ''}`}
            onClick={() => navigate('/main-dashboard')}
          >
            Main Dashboard
          </button>
          <button
            className={`nav-link ${isAdminDashboard ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            Admin Dashboard
          </button>
        </nav>

        {/* Right Actions Section */}
        <div className="header-actions">
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
