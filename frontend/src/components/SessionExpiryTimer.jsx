import React, {useEffect, useMemo, useState} from 'react';
import AuthContext from '../context/AuthContext';

/**
 * Shows a small fixed timer (top-right) counting down to the earliest logout cause:
 * - Access token expiry
 * - Inactivity auto-logout
 */
export default function SessionExpiryTimer() {
    const {
        user,
        isAuthenticated,
        inactivityMs = 15 * 60 * 1000, // fallback
        lastActiveKey = 'lastActiveAt',
    } = React.useContext(AuthContext) || {};

    const [now, setNow] = useState(Date.now());
    const [lastActiveAt, setLastActiveAt] = useState(() => Number(localStorage.getItem(lastActiveKey) || 0));

    // Keep "now" ticking once per second
    useEffect(() => {
        if (!isAuthenticated) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [isAuthenticated]);

    // Track cross-tab activity updates
    useEffect(() => {
        if (!isAuthenticated) return;
        const onStorage = (e) => {
            if (e.key === lastActiveKey) {
                setLastActiveAt(Number(e.newValue || Date.now()));
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [isAuthenticated, lastActiveKey]);

    // Also track same-tab activity writes occurring via axiosInstance/recordActivity
    useEffect(() => {
        if (!isAuthenticated) return;
        const read = () => setLastActiveAt(Number(localStorage.getItem(lastActiveKey) || 0));
        const id = setInterval(read, 1000);
        return () => clearInterval(id);
    }, [isAuthenticated, lastActiveKey]);

    // Deadlines
    const accessExpMs = user?.exp ? user.exp * 1000 : null;
    const idleDeadline = lastActiveAt ? lastActiveAt + inactivityMs : null;

    const {label, remainingMs} = useMemo(() => {
        if (!isAuthenticated) return {label: '', remainingMs: 0};
        const toToken = accessExpMs ? accessExpMs - now : Infinity;
        const toIdle = idleDeadline ? idleDeadline - now : Infinity;

        const minMs = Math.min(toToken, toIdle);
        const label =
            toToken <= toIdle ? 'Token' : 'Idle';

        return {label, remainingMs: Math.max(0, minMs)};
    }, [isAuthenticated, accessExpMs, idleDeadline, now]);

    if (!isAuthenticated || remainingMs === Infinity) return null;

    // Format mm:ss (or h:mm:ss for long sessions)
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const timeStr = hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${minutes}:${String(seconds).padStart(2, '0')}`;

    // Visual state
    const warn = remainingMs <= 2 * 60 * 1000;      // < 2 min
    const danger = remainingMs <= 30 * 1000;        // < 30 sec

    return (
        <div
            style={{
                position: 'fixed',
                top: 10,
                right: 12,
                zIndex: 9999,
                background: '#ffffff',
                border: `1px solid ${danger ? '#dc3545' : warn ? '#fd7e14' : '#ced4da'}`,
                color: danger ? '#dc3545' : warn ? '#fd7e14' : '#212529',
                borderRadius: 999,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                userSelect: 'none',
            }}
            title={`Earliest expiry: ${label === 'Token' ? 'Access token' : 'Inactivity'}\n` +
                (accessExpMs ? `Token: ${new Date(accessExpMs).toLocaleString()}\n` : '') +
                (idleDeadline ? `Idle:  ${new Date(idleDeadline).toLocaleString()}` : '')}
            aria-live="polite"
        >
      <span
          style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: danger ? '#dc3545' : warn ? '#fd7e14' : '#198754',
              display: 'inline-block',
          }}
      />
            <span>{label} expires in</span>
            <span style={{fontVariantNumeric: 'tabular-nums'}}>{timeStr}</span>
        </div>
    );
}
