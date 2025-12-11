# NdalamaHub LMS - AI Coding Agent Instructions

## Project Overview
NdalamaHub is a multi-tenant loan management system built with React 19/Vite frontend and Node.js/Express/MongoDB backend. It serves multiple lenders and corporate clients with role-based access control and comprehensive loan lifecycle management. The system has evolved through 50+ iterations with extensive mobile responsiveness and security enhancements.

## Architecture Essentials

### Multi-Tenant Data Model
- **Critical**: ALL database records must include `company` field (ObjectId reference) for data isolation
- User roles follow hierarchy: `super_user` > `lender_admin` > `corporate_admin` > `corporate_hr` > `lender_user` > `corporate_user`
- Companies have `type: 'lender' | 'corporate'` - lenders provide loans, corporates apply for employee loans
- **Lender-Corporate Relationship**: Corporate companies are linked to lender companies via `lenderCompany` field

### Role-Based Authorization Pattern
```javascript
// Server routes always use middleware chain:
router.get('/', authenticateToken, authorize(['lender_admin', 'corporate_admin']), handler);

// Client components check permissions:
import { canApproveLoan, canDisburseLoan, getCurrentUser } from '@/utils/roleUtils';
const user = getCurrentUser();
if (canApproveLoan(user.role)) { /* show approve button */ }

// Critical: Only lender_admin can disburse loans
if (canDisburseLoan(user.role)) { /* show disburse button */ }
```

### Loan Workflow States
- Application: `pending_approval` → HR/Admin review → `approved`
- Disbursement: Only `lender_admin` can change `approved` → `active`
- Repayment: `active` loans accept payments, can become `completed`
- Rejection: `pending_approval` → `rejected` (by HR/Admin)

### API Structure
- Base URL: `/api/{module}` (auth, users, companies, loans, reports, dashboard, system)
- All endpoints return `{ success: boolean, data?: any, message?: string }`
- Authentication: `Bearer` JWT token in `Authorization` header
- Company filtering happens server-side based on user's company association

## Development Workflows

### Starting Development
```bash
# Root directory - starts both client and server
pnpm start

# Or separately:
pnpm run client  # Vite dev server (port 5173)
pnpm run server  # Node.js API server (port 5000)
```

### Database Operations
```bash
# Server directory
pnpm run seed    # Runs utils/seeder.js to populate test data
node utils/seedSuperUser.js  # Creates initial super_user
```

## Key Patterns & Conventions

### Frontend State Management
- No global state library - uses localStorage for auth: `ndalamahub-token`, `ndalamahub-user`
- API calls via `src/utils/api.js` (axios instance with interceptors)
- Route protection: `<ProtectedRoute>` checks JWT token validity
- User data: Use `getCurrentUser()` from roleUtils, NOT localStorage directly

### Component Structure
- UI components: shadcn/ui in `src/components/ui/`
- Feature components: organized by domain (`auth/`, `loans/`, `companies/`, etc.)
- Layout: `<Navbar />` + protected content pattern throughout
- **Mobile-First**: All components use responsive design with mobile cards + desktop tables

### Role-Specific Dashboards
- `super_user`/`lender_admin`: System-wide stats via `/dashboard/admin-stats`
- `corporate_admin`/`corporate_hr`: Company-specific stats via `/dashboard/hr-stats`
- `corporate_user`: Personal loan stats via `/dashboard/user-stats`
- `lender_admin`: Portfolio stats via `/dashboard/lender-stats`

### Form Patterns
- React Hook Form + Zod validation
- Dialog-based forms for CRUD operations (Create/Edit dialogs)
- File uploads handled via FormData to `/api/loans/upload`
- **Responsive**: Single column on mobile, multi-column on desktop
- **Auto-population**: Corporate users see only their company in dropdowns

### Backend Validation
- Mongoose schemas with extensive validation rules
- Password hashing with bcryptjs
- Phone number formatting via `utils/auth.js`
- Company access validation: Users can only access their company's data
- Employee ID auto-generation if not provided (company prefix + random)

## File Export System
- Reports generate PDF (pdfkit) and Excel (exceljs) files
- Export endpoints: `/api/reports/export/{type}?format=pdf|excel`
- Client triggers download via blob URLs

## Environment Configuration
- Server: MongoDB URI via `process.env.MONGODB_URI`
- Client: API URL via `import.meta.env.VITE_API_URL`
- CORS configured for development (localhost:5173)

## Critical Security Notes
- Super users bypass all company-based filtering - use sparingly
- All loan operations must verify company relationships (applicant.company === user.company)
- JWT tokens include user role and company for middleware decisions
- **Lender Isolation**: Lender admins only see their corporate clients, never other lenders
- **Corporate Restrictions**: HR/Admin users restricted to their company's data only
- **Disbursement Control**: Only `lender_admin` can disburse approved loans to `active`

## Common Development Patterns
```javascript
// API Response Structure (consistent across all endpoints)
{ success: boolean, data?: any, message?: string }

// Company filtering in routes (for corporate users)
if (req.user.role !== 'super_user') {
  filter.company = req.user.company; // Restrict to user's company
}

// Mobile-responsive component pattern
<div className="hidden md:block"> {/* Desktop table */} </div>
<div className="md:hidden"> {/* Mobile cards */} </div>
```

## Deployment
- Frontend: Vite build to `client/dist/`, deployed on Netlify
- Backend: Node.js server with MongoDB Atlas connection
- File storage: Prepared for GCS/S3 integration (currently local)

## Testing & Debug Utilities
```bash
# Server directory utilities
node utils/seedSuperUser.js  # Create initial admin
pnpm run seed               # Populate test data
node list_users.js          # Debug user accounts
node debug_db.js           # Database debugging
```

When modifying this codebase, always maintain the multi-tenant data isolation patterns and role-based access controls. Check existing route handlers in `server/routes/` for authorization patterns before implementing new endpoints.