## Changelog
## All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]
- Added
- Future features will be documented here.

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