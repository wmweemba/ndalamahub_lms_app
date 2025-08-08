import { ROLES } from '@/utils/roleUtils';

export function LoanApprovalActions({ loan, userRole }) {
    // Add corporate_hr to approval checks
    const canApprove = [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN,
        ROLES.CORPORATE_ADMIN,
        ROLES.CORPORATE_HR
    ].includes(userRole);

    return (
        <div>
            {canApprove && (
                <button>
                    Approve Loan
                </button>
            )}
            {/* ...existing code... */}
        </div>
    );
}