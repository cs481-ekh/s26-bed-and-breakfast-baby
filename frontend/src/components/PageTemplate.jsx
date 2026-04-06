import { useEffect, useState, useCallback } from 'react';
import Header from './Header';
import { apiJson } from '../apiClient';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import './PageTemplate.css';

export default function PageTemplate({ children }) {
  const [authState, setAuthState] = useState('loading');
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      const { response } = await apiJson('/api/me/');

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setAuthState('authenticated');
        return;
      }

      setAuthState('unauthenticated');
      window.location.replace('/login');
    };

    verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleWarn = useCallback(() => {
    setShowIdleWarning(true);
  }, []);

  const handleTimeout = useCallback(async () => {
    try {
      await apiJson('/api/auth/logout/', { method: 'POST' });
    } finally {
      window.location.replace('/login?reason=idle');
    }
  }, []);

  const { resetTimer } = useIdleTimeout({
    onWarn: handleWarn,
    onTimeout: handleTimeout,
  });

  const handleStayLoggedIn = () => {
    setShowIdleWarning(false);
    resetTimer();
  };

  if (authState !== 'authenticated') {
    return <main className="page-content">Checking session...</main>;
  }

  return (
    <div className="page-layout">
      <Header />
      {showIdleWarning && (
        <div className="idle-warning-banner">
          <span>You will be logged out in 1 minute due to inactivity.</span>
          <button onClick={handleStayLoggedIn}>Stay Logged In</button>
        </div>
      )}
      <main className="page-content">
        {children}
      </main>
    </div>
  );
}
