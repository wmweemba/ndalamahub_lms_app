import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '@/utils/roleUtils';

const ProtectedRoute = ({ children }) => {
  const currentUser = getCurrentUser();
  
  // If no user is logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default ProtectedRoute;