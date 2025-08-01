# NdalamaHub Backend API

This is the backend API for the NdalamaHub loan management system.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: CRUD operations for users with 5 distinct roles
- **Company Management**: Multi-tenant architecture supporting lender and corporate companies
- **Loan Management**: Complete loan lifecycle from application to repayment
- **Reporting & Analytics**: Comprehensive reporting with various filters and exports

## Setup Instructions

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the server directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ndalamahub

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Optional: Email Configuration (for password reset)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Optional: File Upload Configuration
# UPLOAD_PATH=./uploads
# MAX_FILE_SIZE=5242880
```

### 3. Database Setup

Make sure MongoDB is running locally or update the `MONGODB_URI` to point to your MongoDB instance.

### 4. Start the Server

```bash
# Development mode with auto-restart
pnpm run dev

# Production mode
pnpm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile

### Users

- `GET /api/users` - Get all users (with filters)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/password` - Change user password

### Companies

- `GET /api/companies` - Get all companies (with filters)
- `GET /api/companies/:id` - Get company by ID
- `POST /api/companies` - Create new company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company
- `GET /api/companies/:id/users` - Get users for a specific company

### Loans

- `GET /api/loans` - Get all loans (with filters)
- `GET /api/loans/:id` - Get loan by ID
- `POST /api/loans` - Create new loan application
- `PUT /api/loans/:id/approve` - Approve loan application
- `PUT /api/loans/:id/reject` - Reject loan application
- `PUT /api/loans/:id/disburse` - Disburse approved loan
- `PUT /api/loans/:id/repayment` - Record loan repayment
- `GET /api/loans/:id/summary` - Get loan summary

### Reports

- `GET /api/reports/overview` - Get overview statistics
- `GET /api/reports/loans` - Get detailed loan report
- `GET /api/reports/companies` - Get company-wise loan statistics
- `GET /api/reports/users` - Get user-wise loan statistics
- `GET /api/reports/export` - Export loan data to CSV/JSON

## User Roles

1. **Super User**: Full system admin rights
2. **Client Admin**: Manages lending company and corporate clients
3. **Corporate Admin**: Manages a specific corporate entity
4. **Corporate HR**: Manages employee records and loan approvals
5. **Staff**: Can submit loan requests and view repayment schedules

## Database Models

### User Model
- Personal information (name, email, phone)
- Role-based access control
- Company association
- Department and employee ID for staff
- Password hashing and validation

### Company Model
- Multi-tenant structure (lender/corporate)
- Company settings and configurations
- Address and contact information
- Relationship between lenders and corporate clients

### Loan Model
- Complete loan lifecycle management
- Automatic calculation of interest and payments
- Repayment schedule generation
- Document upload support
- Guarantor information

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

## Rate Limiting

Login attempts are rate-limited to 5 attempts per 15 minutes per IP address.

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based authorization
- Input validation and sanitization
- Company-level access control
- Rate limiting for sensitive endpoints

## Development

### Running Tests

```bash
pnpm test
```

### Code Structure

```
server/
├── models/          # Database models
├── routes/          # API route handlers
├── middleware/      # Authentication and authorization
├── utils/           # Utility functions
├── config/          # Configuration files
└── server.js        # Main server file
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong JWT secret
3. Configure MongoDB Atlas or production database
4. Set up proper logging and monitoring
5. Configure email service for password reset
6. Set up file upload storage (AWS S3, etc.)
7. Configure CORS for your frontend domain
8. Set up SSL/TLS certificates

## API Documentation

For detailed API documentation, refer to the individual route files or use tools like Postman to explore the endpoints. 