import { ROLES } from '@/utils/roleUtils';

export function LoanApprovalActions({ loan, userRole }) {
    // Add employer_hr to approval checks
    const canApprove = [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.EMPLOYER_ADMIN,
        ROLES.EMPLOYER_HR
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