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