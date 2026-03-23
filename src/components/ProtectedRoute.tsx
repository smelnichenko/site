import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

function ProtectedRoute({ children, permission }: Readonly<ProtectedRouteProps>) {
  const { isAuthenticated, hasPermission, initializing } = useAuth();
  const location = useLocation();

  // Wait for silent auth to complete before deciding to redirect
  if (initializing) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
