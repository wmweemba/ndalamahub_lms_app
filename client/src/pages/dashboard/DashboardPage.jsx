import { Navigate } from 'react-router-dom';
import { getCurrentUser, ROLES } from '@/utils/roleUtils';
import { LenderDashboard } from '@/components/dashboard/LenderDashboard';
import { EmployerDashboard } from '@/components/dashboard/EmployerDashboard';
import { PlatformDashboard } from '@/components/dashboard/PlatformDashboard';
import { BorrowerDashboard } from '@/components/dashboard/BorrowerDashboard';

export default function DashboardPage() {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role === ROLES.PLATFORM_ADMIN) {
    return <PlatformDashboard />;
  }

  if ([ROLES.LENDER_ADMIN, ROLES.LENDER_OFFICER].includes(currentUser.role)) {
    return <LenderDashboard />;
  }

  if ([ROLES.EMPLOYER_ADMIN, ROLES.EMPLOYER_HR].includes(currentUser.role)) {
    return <EmployerDashboard />;
  }

  return <BorrowerDashboard />;
}
