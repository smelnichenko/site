import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchApprovalStatus } from '../services/api';

function PendingApproval() {
  const { logout, refreshPermissions } = useAuth();
  const [status, setStatus] = useState<string>('PENDING');
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function poll() {
      try {
        const data = await fetchApprovalStatus(controller.signal);
        setStatus(data.status);
        if (data.reason) setReason(data.reason);

        if (data.status === 'APPROVED') {
          await refreshPermissions();
        }
      } catch {
        // Ignore errors (e.g., aborted, network)
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refreshPermissions]);

  if (status === 'DECLINED') {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
        <h2>Registration Declined</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
          Your registration could not be approved.
          {reason && <><br /><br />Reason: {reason}</>}
        </p>
        <button className="btn-logout" onClick={logout} style={{ marginTop: 20 }}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
      <h2>Account Pending Approval</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
        Your account is pending approval. You'll receive an email when your account is approved.
      </p>
      <button className="btn-logout" onClick={logout} style={{ marginTop: 20 }}>
        Logout
      </button>
    </div>
  );
}

export default PendingApproval;
