## Changelog
## All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]
- Added
- Future features will be documented here.

## [0.2.38] - 2025-08-28
### Fixed
- Fixed dashboard statistics not displaying correct counts for active companies and users
- Updated dashboard API to use correct field names (isActive boolean instead of status string)

## [0.1.0] - 2025-08-01
## Added
- Initial project scaffolding and documentation.
- Created a detailed Full-Stack Development Guide outlining the phased approach for building the application.
- Established a clear folder structure for the client (React PWA) and server (Node.js/Express) directories.
- Configured the environment to use pnpm as the package manager and MongoDB Atlas as the database.
- Implemented a concurrently script in the root package.json to run both the client and server development environments with a single command.
- Added a comprehensive .gitignore file to prevent committing dependencies, environment variables, and temporary files.
- Setup React with Vite and Tailwind CSS for the frontend.
- Setup a Node.js server with Express, Mongoose, and authentication libraries for the backend.

## [0.2.0] - 2025-08-01
## Added
- **Complete Backend API Implementation**:
  - **Database Models**: User, Company, and Loan models with comprehensive schemas and relationships
  - **Authentication System**: JWT-based authentication with role-based access control for 5 distinct roles
  - **User Management**: Full CRUD operations with role-based permissions and company access control
  - **Company Management**: Multi-tenant architecture supporting lender and corporate companies
  - **Loan Management**: Complete loan lifecycle from application to repayment with automatic calculations
  - **Reporting & Analytics**: Comprehensive reporting with various filters, date ranges, and export functionality
  - **Security Features**: Password hashing, rate limiting, input validation, and company-level access control
  - **API Documentation**: Complete README with setup instructions and endpoint documentation
  - **Username-Based Authentication**: Unique username system replacing email-based login
  - **Database Seeding**: Comprehensive seeder with sample companies and users for development
  - **Express Version Fix**: Resolved path-to-regexp compatibility issue by downgrading from Express 5.x to Express 4.21.2

## [0.2.1] - 2025-08-01
### Fixed
- **Environment Configuration**:
  - Resolved environment variable loading issues by consolidating `.env` files
  - Moved all server environment variables to `/server/.env`
  - Removed duplicate `.env` file from root directory
  - Added proper environment variable structure for client-side in `/client/.env`

- **Database Configuration**:
  - Removed deprecated MongoDB connection options (`useNewUrlParser`, `useUnifiedTopology`)
  - Fixed MongoDB connection string handling in seeder script
  - Resolved duplicate index warnings in Mongoose schemas
  - Improved security by updating MongoDB Atlas credentials

- **Code Quality**:
  - Updated `.gitignore` to properly exclude all environment files
  - Standardized environment variable naming conventions
  - Improved error handling in seeder scripts
  - Enhanced logging for better debugging information
  - Removed unused dependencies and scripts

## [0.2.2] - 2025-08-04
### Added
- **Super User Seeding**:
  - Created dedicated seeder script for initial super user and company setup
  - Implemented comprehensive validation for company and user creation
  - Added clear console feedback with emoji indicators for seeding progress

### Fixed
- **Database Seeding**:
  - Resolved schema validation errors in company creation
  - Added missing required fields for contact information
  - Fixed user role and company relationship setup
  - Improved error handling and user feedback in seeder scripts

### Security
- **Authentication**:
  - Enhanced password security for super user account
  - Standardized credential output format
  - Added clear login instructions after seeding

## [0.2.3] - 2025-08-04
### Added
- **Frontend Authentication**:
  - Implemented login page with form validation
  - Added authentication service layer
  - Setup axios for API requests
  - Created protected route system
  - Added token-based authentication handling

## [0.2.4] - 2025-08-04
### Added
- **Frontend Login Implementation**:
  - Created AuthLayout component with consistent styling
  - Implemented LoginForm component with validation
  - Added responsive form design with Tailwind CSS
  - Integrated form icons and loading states
  - Added error handling and display
  - Setup proper routing structure for authentication flow

### Fixed
- **Frontend Structure**:
  - Reorganized component hierarchy for better maintainability
  - Fixed component export/import issues
  - Resolved form rendering issues
  - Improved error message display

## [0.2.5] - 2025-08-04
### Added
- **Dashboard Enhancement**:
  - Added statistics cards using shadcn/ui components
  - Implemented real-time dashboard data fetching
  - Created company overview section
  - Added system health monitoring card
  - Integrated responsive grid layout
  - Added loading and error states

## [0.2.6] - 2025-08-04
### Added
- **Backend Dashboard API**:
  - Created dashboard statistics endpoint
  - Added company-specific data filtering
  - Implemented role-based access control
  - Added active entity counting
  - Integrated loan amount calculations
  - Added error handling and logging

## [0.2.7] - 2025-08-04
### Enhanced
- **Loan Model**:
  - Added comprehensive status tracking
  - Implemented risk assessment structure
  - Added rejection tracking
  - Enhanced payment tracking
  - Improved arrears calculation
  - Added automated status updates
  - Enhanced validation rules

## [0.2.8] - 2025-08-04
### Added
- **Navigation System**:
  - Created responsive navbar component
  - Added navigation icons with labels
  - Implemented mobile-first design approach
  - Added active route indicators
  - Integrated logout functionality
  - Created centered content layout
  - Added nested routing for authenticated pages

## [0.2.9] - 2025-08-04
### Added
- **Company Management**:
  - Created companies list page with table view
  - Implemented company creation dialog
  - Added company editing functionality
  - Implemented company deletion with confirmation
  - Added status and type indicators
  - Created company CRUD API endpoints
  - Added role-based access control for company management
  - Implemented form validation and error handling

## [0.2.10] - 2025-08-04
### Fixed
- **Routing**:
  - Added missing Companies page route to main App component
  - Fixed companies management page navigation
  - Ensured proper route nesting for authenticated pages

## [0.2.11] - 2025-08-06
### Fixed
- **Authentication Middleware**:
  - Fixed authorizeRole middleware export
  - Added role hierarchy for better permission management
  - Enhanced error messages for authentication failures
  - Added proper middleware chaining support
  - Improved token verification process

## [0.2.12] - 2025-08-04
### Fixed
- **Authentication System**:
  - Added missing authorize middleware function
  - Enhanced role-based access control
  - Added support for multiple role authorization
  - Improved company access validation
  - Added comprehensive authorization middleware exports

## [0.2.13] - 2025-08-06
### Fixed
- **Database Schemas**:
  - Removed duplicate index definitions in Company model
  - Removed duplicate index definitions in Loan model
  - Cleaned up deprecated MongoDB connection options
  - Optimized schema structure for better performance

## [0.2.14] - 2025-08-06
### Enhanced
- **Project Structure**:
  - Moved database connection logic to dedicated config file
  - Improved error handling for database connection
  - Added connection status logging
  - Implemented better separation of concerns
  - Enhanced configuration management

## [0.2.15] - 2025-08-06
### Fixed
- **Companies Page UI**:
  - Improved error state handling
  - Maintained visibility of create button during errors
  - Enhanced error message presentation
  - Fixed header persistence across all states

## [0.2.19] - 2025-08-07
### Fixed
- **Company Creation**:
  - Enhanced authorization debugging
  - Added detailed error logging
  - Improved role verification feedback
  - Added token validation logging

## [0.2.20] - 2025-08-07
### Fixed
- **Authentication**:
  - Added user role to JWT token payload
  - Enhanced token debugging
  - Fixed role-based authorization
  - Added payload verification logging
  - Updated token structure documentation

## [0.2.21] - 2025-08-07
### Fixed
- **Authentication**:
  - Fixed missing role in JWT token payload
  - Updated token structure to include all required user data
  - Added comprehensive token payload logging
  - Standardized token payload format

## [0.2.22] - 2025-08-07
### Fixed
- **Authentication**:
  - Corrected token payload structure
  - Added immediate token verification after generation
  - Enhanced debug logging for token creation
  - Fixed user role inclusion in token
  - Added payload verification steps

## [0.2.23] - 2025-08-08
### Fixed
- **Company Management**:
  - Updated company deletion endpoint to use findByIdAndDelete
  - Added proper error handling for company deletion
  - Enhanced deletion confirmation response
  - Added company existence check before deletion

## [0.2.24] - 2025-08-08
### Added
- **Role Management**:
  - Added corporate_hr role to role hierarchy
  - Updated role levels to accommodate new HR role
  - Positioned HR role between corporate_admin and lender_user
  - Enhanced role-based access control

## [0.2.25] - 2025-08-08
### Updated
- **Role System Enhancement**:
  - Updated User model schema with corporate_hr role
  - Added role constants across frontend and backend
  - Enhanced loan approval permissions for HR role
  - Updated user seeder with HR role examples
  - Modified role-based component permissions
  - Updated role documentation

## [0.2.26] - 2025-08-08
### Documentation
- **README Updates**:
  - Added role hierarchy documentation
  - Updated user roles section
  - Enhanced permissions documentation
  - Added token payload structure
  - Updated authentication details

## [0.2.27] - 2025-08-08
### Fixed
- **User Management**:
  - Enhanced company validation in user creation
  - Added detailed error messages for company association
  - Improved user creation error handling
  - Added company existence check

## [0.2.28] - 2025-08-08
### Fixed
- **User Management**:
  - Fixed middleware import in users route
  - Added missing authorizeRole import
  - Maintained existing authorization flow
  - Enhanced route security checks

## [0.2.29] - 2025-08-21
### Fixed
- **User Management**:
  - Resolved duplicate username error handling for user creation

## [0.2.30] - 2025-08-26
### Fixed
- **Loan Application Workflow**:
  - Resolved validation errors for calculated loan fields by updating Loan model schema
  - Removed duplicate status field from Loan schema
  - Ensured applicant field is set correctly from fetched user document
  - Improved pre-save hook reliability for loan calculations
  - Verified company association and user lookup logic in loan creation route
  - Successfully tested end-to-end loan application creation for corporate users

## [0.2.31] - 2025-08-26
### Fixed
- **Loan Approval Workflow**:
  - Fixed company ID comparison for loan approval access control
  - Enabled corporate HR users to approve loans for their company
  - Added debug logging for company ID checks in loan approval route
  - Successfully tested loan approval by HR user

## [0.2.32] - 2025-08-27
### Fixed
- **Loan Disbursement Workflow**:
  - Corrected company ID comparison in loan disbursement route to match approval logic
  - Enabled authorized users to successfully disburse loans for their company
  - Verified end-to-end loan lifecycle from application to disbursement

## [0.2.33] - 2025-08-27
### Fixed
- **Loan Repayment Workflow**:
  - Documented and tested loan repayment route for installment payments
  - Clarified HTTP method and request structure for repayments
  - Ensured lenderadmin and authorized users can post repayments successfully

- **Loan Rejection Workflow**:
  - Fixed company ID comparison in loan rejection route to match approval/disbursement logic
  - Updated rejection status logic to allow rejection for 'pending_approval' loans
  - Enabled corporate HR users to reject loans in correct status
  - Verified loan rejection and error handling

## [0.2.37] - 2025-08-28
### Fixed
- **Company Management Interface**:
  - Fixed company status display to use correct `isActive` boolean field instead of non-existent `status` field
  - Corrected status badge colors and labels to show "Active" or "Inactive" properly
  - Implemented complete edit company functionality with working edit button
  - Created comprehensive EditCompanyDialog component with full CRUD capabilities
  - Added proper form pre-population with existing company data in edit dialog
  - Enabled dynamic lender selection when editing corporate companies
  - Added company status toggle between Active/Inactive in edit form
  - Implemented success feedback and error handling for company updates
  - Added proper API integration with PUT `/companies/:id` endpoint for updates
  - Enhanced company management workflow with seamless edit and update functionality

## [0.2.36] - 2025-08-28
### Enhanced
- **Company Creation Modal**:
  - Enhanced CreateCompanyDialog with comprehensive form structure using card-based layout
  - Added dynamic lender company selection for corporate companies
  - Implemented conditional form fields that show/hide based on company type selection
  - Added automatic fetching of available lender companies for corporate company creation
  - Included proper form validation requiring lender selection for corporate companies
  - Enhanced user experience with success feedback screen and loading states
  - Improved form styling with proper labels, placeholders, and responsive design
  - Added comprehensive address and contact information sections
  - Fixed company creation workflow to properly handle lenderCompany field requirement
  - Enhanced error handling with visual feedback and detailed error messages

## [0.2.35] - 2025-08-28
### Added
- **Loans Management Interface**:
  - Created comprehensive LoansPage component with table view displaying loan summaries
  - Implemented LoanDetailsDialog component with full loan information display
  - Added interactive loan management with click-to-view details functionality
  - Integrated loan action buttons for approve, reject, and disburse operations
  - Added proper role-based permissions for loan management actions
  - Implemented responsive design with status color coding and currency formatting
  - Added comprehensive error handling and loading states for loan operations
  - Integrated with existing API endpoints for full loan lifecycle management
  - Added loans route to main application navigation and routing system
  - Enhanced loan data presentation with applicant, company, and financial details

## [0.2.34] - 2025-08-28
### Fixed
- **Frontend Dashboard Issues**:
  - Fixed API response data structure handling in DashboardPage component
  - Corrected client-side data access from `response.data` to `response.data.data` to match server response format
  - Changed DashboardPage to default export and updated corresponding import in App.jsx
  - Enhanced error handling and logging for better debugging
  - Added response format validation to prevent rendering errors
  - Resolved blank dashboard page and component error boundary issues

- **Frontend Build Configuration**:
  - Fixed favicon.ico 404 error by adding proper favicon file to public directory
  - Updated HTML head section to reference correct favicon path and type
  - Improved page title from generic "Vite + React" to "Ndalama Hub LMS"


