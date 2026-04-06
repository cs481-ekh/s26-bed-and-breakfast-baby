import { useEffect, useRef, useCallback } from 'react';

//20 minute timer 
//this could change, need to ask team to see what they think is good length
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;   
//warning timer before logout
const WARN_BEFORE_MS  =  1 * 60 * 1000;  

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

/**
 * Tracks user inactivity. Calls onWarn when 1 minute remains, onTimeout when
 * the idle period expires. Calling resetTimer() resets the countdown (e.g.
 * when the user clicks "Stay logged in").
 */
export function useIdleTimeout({ onWarn, onTimeout }) {
  const warnTimer    = useRef(null);
  const logoutTimer  = useRef(null);

  const clearTimers = useCallback(() => {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimers();
    warnTimer.current   = setTimeout(onWarn,    IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    logoutTimer.current = setTimeout(onTimeout, IDLE_TIMEOUT_MS);
  }, [clearTimers, onWarn, onTimeout]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer, clearTimers]);

  return { resetTimer };
}
