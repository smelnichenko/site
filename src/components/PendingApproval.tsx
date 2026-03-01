import { useAuth } from '../contexts/AuthContext';

function PendingApproval() {
  const { logout } = useAuth();

  return (
    <div className="card" style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
      <h2>Account Pending Approval</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
        Your account has been created but is not yet approved.
        An administrator will grant you access shortly.
      </p>
      <button className="btn-logout" onClick={logout} style={{ marginTop: 20 }}>
        Logout
      </button>
    </div>
  );
}

export default PendingApproval;
