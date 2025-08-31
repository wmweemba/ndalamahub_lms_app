# NdalamaHub Backend API

A comprehensive loan management system backend built with Node.js, Express, MongoDB, and JWT authentication. This API provides role-based access control for managing users, companies, loans, and financial operations in a multi-tenant environment.

## 🚀 Features

- **JWT Authentication & Authorization**: Secure token-based authentication with role hierarchy
- **Multi-Tenant Architecture**: Support for lender companies and their corporate clients
- **Comprehensive Loan Management**: Full lifecycle from application to repayment
- **Role-Based Access Control**: 6 distinct user roles with specific permissions
- **Real-Time Dashboard Analytics**: Role-specific dashboard statistics
- **Advanced Reporting**: Detailed reports with filtering and export capabilities
- **User Management**: Complete CRUD operations with company-based restrictions
- **Security Features**: Password hashing, rate limiting, input validation

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (v4.4 or higher)
- **pnpm** (v7 or higher)

## ⚡ Quick Start

### 1. Install Dependencies

```bash
cd server
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ndalamahub
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ndalamahub

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters

# Optional: Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

### 3. Database Setup & Seeding

```bash
# Start MongoDB service (if running locally)
# On Windows: net start MongoDB
# On Mac/Linux: sudo systemctl start mongod

# Seed the database with initial data
pnpm run seed
```

### 4. Start the Server

```bash
# Development mode with auto-restart
pnpm run dev

# Production mode
pnpm start
```

The server will start on `http://localhost:5000`

## 🏗️ Architecture Overview

### Directory Structure

```
server/
├── config/
│   └── db.js                 # MongoDB connection configuration
├── constants/
│   └── roles.js              # Role definitions and constants
├── middleware/
│   └── auth.js               # Authentication and authorization middleware
├── models/
│   ├── User.js               # User model schema
│   ├── Company.js            # Company model schema
│   └── Loan.js               # Loan model schema
├── routes/
│   ├── auth.js               # Authentication endpoints
│   ├── users.js              # User management endpoints
│   ├── companies.js          # Company management endpoints
│   ├── loans.js              # Loan management endpoints
│   ├── dashboard.js          # Dashboard analytics endpoints
│   ├── reports.js            # Reporting endpoints
│   └── system.js             # System administration endpoints
├── utils/
│   ├── auth.js               # Authentication utilities
│   ├── seeder.js             # Database seeding utilities
│   └── seedSuperUser.js      # Initial super user creation
├── package.json              # Dependencies and scripts
├── server.js                 # Main application entry point
└── README.md                 # This file
```

## 👥 User Roles & Permissions

The system implements a hierarchical role-based access control with 6 distinct roles:

### Role Hierarchy (Highest to Lowest)

1. **Super User** (`super_user`) - Level 5
   - Full system administration rights
   - Manage all companies and users across the system
   - Configure system-wide settings
   - Access all endpoints without restrictions

2. **Lender Admin** (`lender_admin`) - Level 4
   - Manage lending company operations
   - Create and manage corporate client companies
   - Access loans from their company and client companies
   - Disburse and manage loan repayments
   - Cannot create additional lender companies

3. **Corporate Admin** (`corporate_admin`) - Level 3
   - Manage their corporate company settings
   - Oversee all company operations and HR functions
   - Access company-wide reports and analytics
   - Manage company users (create, edit, delete)

4. **Corporate HR** (`corporate_hr`) - Level 2
   - Approve and reject employee loan applications
   - Manage employee records within their company
   - Access HR-specific dashboards and reports
   - Create and manage corporate users and other HR staff

5. **Lender User** (`lender_user`) - Level 1
   - Process loan applications and payments
   - View loans related to their lender company
   - Generate basic reports for assigned portfolios

6. **Corporate User** (`corporate_user`) - Level 0
   - Submit personal loan applications
   - View own loan status and history
   - Make loan payments and track repayments
   - Access personal dashboard with loan summary

### Permission Matrix

| Action | Super User | Lender Admin | Corporate Admin | Corporate HR | Lender User | Corporate User |
|--------|------------|--------------|-----------------|--------------|-------------|----------------|
| Create Companies | ✅ All | ✅ Corporate only | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ All | ✅ Company scope | ✅ Company scope | ✅ Company scope | ❌ | ❌ |
| Submit Loans | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve Loans | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Disburse Loans | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View All Loans | ✅ | ✅ Portfolio | ✅ Company | ✅ Company | ✅ Portfolio | ❌ Own only |
| Access Reports | ✅ All | ✅ Portfolio | ✅ Company | ✅ Company | ✅ Limited | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 🔐 Authentication & Security

### JWT Token Structure

Authentication uses JWT tokens with the following payload structure:

```json
{
  "id": "user_mongodb_id",
  "username": "user_username",
  "role": "user_role",
  "company": "company_mongodb_id",
  "iat": 1640995200,
  "exp": 1641600000
}
```

### Frontend Integration Guidelines

#### 1. Authentication Flow

```javascript
// Login request
const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'your_username',
    password: 'your_password'
  })
});

const { token, user } = await loginResponse.json();

// Store token for subsequent requests
localStorage.setItem('token', token);
localStorage.setItem('user', JSON.stringify(user));
```

#### 2. Making Authenticated Requests

```javascript
// Include token in Authorization header
const response = await fetch('http://localhost:5000/api/loans', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  }
});

const data = await response.json();
```

#### 3. Error Handling

```javascript
const handleApiResponse = async (response) => {
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return;
    }
    
    const errorData = await response.json();
    throw new Error(errorData.message || 'API request failed');
  }
  
  return await response.json();
};
```

#### 4. Role-Based UI Components

```javascript
// Example utility function for role checking
const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

const hasPermission = (requiredRole) => {
  const user = getCurrentUser();
  if (!user) return false;
  
  const roleHierarchy = {
    'super_user': 5,
    'lender_admin': 4,
    'corporate_admin': 3,
    'corporate_hr': 2,
    'lender_user': 1,
    'corporate_user': 0
  };
  
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
};

// Usage in React components
const CanManageUsers = ({ children }) => {
  return hasPermission('corporate_hr') ? children : null;
};
```

## 📡 API Endpoints Reference

### Base URL
```
http://localhost:5000/api
```

### 🔑 Authentication Routes (`/api/auth`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/login` | Public | User login with username/password |
| POST | `/auth/register` | Public | Register new user (with restrictions) |
| POST | `/auth/refresh` | Public | Refresh JWT token |
| POST | `/auth/forgot-password` | Public | Request password reset |
| POST | `/auth/reset-password` | Public | Reset password with token |
| POST | `/auth/logout` | Private | Logout user (client-side token cleanup) |
| GET | `/auth/me` | Private | Get current user profile |

#### Login Request Example
```json
POST /api/auth/login
{
  "username": "admin",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f5d8b8e1234567890abcde",
    "username": "admin",
    "role": "super_user",
    "name": "Admin User"
  }
}
```

### 👥 User Management Routes (`/api/users`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/users` | corporate_hr+ | Get all users (company-scoped) |
| GET | `/users/:id` | Private | Get user by ID |
| POST | `/users` | corporate_hr+ | Create new user |
| PUT | `/users/:id` | Private | Update user (own or authorized) |
| PUT | `/users/:id/password` | Private | Change user password |
| DELETE | `/users/:id` | corporate_hr+ | Delete user |

#### Create User Request Example
```json
POST /api/users
{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john.doe@company.com",
  "phone": "+260971234567",
  "password": "securePassword123",
  "role": "corporate_user",
  "company": "64f5d8b8e1234567890abcde",
  "department": "Finance",
  "employeeId": "EMP001"
}
```

### 🏢 Company Management Routes (`/api/companies`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/companies` | Private | Get all companies (role-filtered) |
| POST | `/companies` | super_user / lender_admin* | Create new company |
| PUT | `/companies/:id` | super_user | Update company |
| DELETE | `/companies/:id` | super_user | Delete company |

*Note: Lender admins can only create corporate companies linked to their lender company.

#### Create Company Request Example
```json
POST /api/companies
{
  "name": "ABC Corporate Ltd",
  "type": "corporate",
  "lenderCompany": "64f5d8b8e1234567890abcde",
  "registrationNumber": "REG123456",
  "taxNumber": "TAX789012",
  "address": {
    "street": "123 Business Ave",
    "city": "Lusaka",
    "province": "Lusaka",
    "country": "Zambia",
    "postalCode": "10101"
  },
  "contactInfo": {
    "email": "contact@abccorp.com",
    "phone": "+260211234567",
    "website": "https://abccorp.com"
  }
}
```

### 💰 Loan Management Routes (`/api/loans`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/loans` | Private | Get loans (role-filtered, with pagination) |
| GET | `/loans/:id` | Private | Get loan details by ID |
| GET | `/loans/:id/summary` | Private | Get loan summary |
| POST | `/loans` | corporate_user+ | Submit loan application |
| PUT | `/loans/:id/approve` | corporate_hr+ | Approve loan application |
| PUT | `/loans/:id/reject` | corporate_hr+ | Reject loan application |
| PUT | `/loans/:id/disburse` | lender_admin+ | Disburse approved loan |
| PUT | `/loans/:id/repayment` | lender_admin+ | Record loan repayment |

#### Loan Application Request Example
```json
POST /api/loans
{
  "amount": 50000,
  "purpose": "Home improvement",
  "loanTerm": 24,
  "monthlyIncome": 15000,
  "collateral": "Vehicle - Toyota Camry 2018",
  "description": "Need funds for home renovation project"
}
```

#### Loan Approval Request Example
```json
PUT /api/loans/:id/approve
{
  "comments": "Application approved based on credit assessment",
  "approvedAmount": 45000,
  "approvedTerm": 24,
  "interestRate": 15.5
}
```

### 📊 Dashboard Routes (`/api/dashboard`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/dashboard/stats` | corporate_admin+ | Admin dashboard statistics |
| GET | `/dashboard/hr-stats` | corporate_hr+ | HR dashboard statistics |
| GET | `/dashboard/user-stats` | Private | User personal dashboard |

#### Dashboard Response Example
```json
GET /api/dashboard/user-stats
{
  "success": true,
  "data": {
    "loanSummary": {
      "totalLoans": 3,
      "activeLoans": 1,
      "pendingLoans": 1,
      "completedLoans": 1,
      "totalLoanAmount": 150000,
      "activeLoanAmount": 50000
    },
    "recentActivity": [...],
    "nextPaymentDue": {
      "amount": 2500,
      "dueDate": "2025-09-15T00:00:00.000Z",
      "loanNumber": "LN-2025-001"
    }
  }
}
```

### 📈 Reports Routes (`/api/reports`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/reports/overview` | corporate_hr+ | Overview statistics |
| GET | `/reports/active-loans` | corporate_hr+ | Active loans report |
| GET | `/reports/overdue-loans` | corporate_hr+ | Overdue loans report |
| GET | `/reports/upcoming-payments` | corporate_hr+ | Upcoming payments report |
| GET | `/reports/:type/export/:format` | corporate_hr+ | Export reports (CSV/JSON) |

### ⚙️ System Routes (`/api/system`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/system/info` | lender_admin+ | System information |
| GET | `/system/settings` | lender_admin+ | Get system settings |
| PUT | `/system/settings` | super_user | Update system settings |
| GET | `/system/health` | corporate_admin+ | Health check |

### 🏥 Health Check

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/health` | Public | API health status |

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## 🔧 Frontend Integration Examples

### React/Next.js Integration

#### 1. API Service Setup
```javascript
// services/api.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  }

  // Auth methods
  login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  getCurrentUser() {
    return this.request('/auth/me');
  }

  // Loan methods
  getLoans(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/loans?${query}`);
  }

  createLoan(loanData) {
    return this.request('/loans', {
      method: 'POST',
      body: JSON.stringify(loanData),
    });
  }

  approveLoan(loanId, approvalData) {
    return this.request(`/loans/${loanId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
  }

  // Dashboard methods
  getDashboardStats() {
    return this.request('/dashboard/user-stats');
  }

  getHRDashboardStats() {
    return this.request('/dashboard/hr-stats');
  }
}

export default new ApiService();
```

#### 2. Authentication Hook
```javascript
// hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
import ApiService from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      ApiService.getCurrentUser()
        .then(response => {
          setUser(response.data.user);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const response = await ApiService.login(username, password);
    localStorage.setItem('token', response.token);
    setUser(response.user);
    return response;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const hasPermission = (requiredRole) => {
    if (!user) return false;
    
    const roleHierarchy = {
      'super_user': 5,
      'lender_admin': 4,
      'corporate_admin': 3,
      'corporate_hr': 2,
      'lender_user': 1,
      'corporate_user': 0
    };
    
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      hasPermission 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

#### 3. Protected Route Component
```javascript
// components/ProtectedRoute.js
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (requiredRole && !hasPermission(requiredRole)) {
        router.push('/unauthorized');
      }
    }
  }, [user, loading, requiredRole]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  if (requiredRole && !hasPermission(requiredRole)) {
    return null;
  }

  return children;
};

export default ProtectedRoute;
```

## 🚀 Production Deployment

### Environment Configuration
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ndalamahub
JWT_SECRET=your-production-jwt-secret-minimum-32-characters-long
CORS_ORIGIN=https://your-frontend-domain.com
```

### Security Checklist
- [ ] Use strong JWT secret (minimum 32 characters)
- [ ] Configure MongoDB Atlas with IP whitelist
- [ ] Set up proper CORS origins
- [ ] Enable MongoDB Atlas encryption
- [ ] Configure rate limiting for production
- [ ] Set up SSL/TLS certificates
- [ ] Configure proper logging and monitoring
- [ ] Set up database backups
- [ ] Configure environment variables securely
- [ ] Review and test all API endpoints

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🛠️ Development Tools

### Available Scripts
```bash
pnpm start          # Start production server
pnpm run dev        # Start development server with nodemon
pnpm test           # Run tests (when configured)
pnpm run seed       # Seed database with sample data
```

### Testing the API
Use tools like Postman, Insomnia, or Thunder Client with the following base configuration:

- **Base URL**: `http://localhost:5000/api`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_JWT_TOKEN` (for protected routes)

### Database Seeding
The seeder creates:
- Super user account
- Sample lender company
- Sample corporate companies
- Test users with different roles
- Sample loan applications

## 📞 Support & Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check connection string format
   - Verify network connectivity

2. **JWT Token Invalid**
   - Check JWT_SECRET configuration
   - Verify token expiration
   - Ensure proper token format

3. **CORS Errors**
   - Configure proper CORS origins
   - Check frontend URL configuration

### Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (server-side issues)

### Logging
The API logs important events and errors. Check console output for debugging information during development.

---

**Documentation Version**: 2.48  
**Last Updated**: August 31, 2025  
**API Version**: 1.0.0

For additional support, please refer to the changelog.md file for recent updates and changes.