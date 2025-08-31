# NdalamaHub Frontend

A modern React-based frontend for the NdalamaHub Loan Management System. Built with React 19, Vite, TailwindCSS, and shadcn/ui components, providing a responsive and intuitive interface for managing loans, users, companies, and financial operations.

## 🚀 Tech Stack

- **React 19** - Latest React with concurrent features
- **Vite** - Fast build tool and development server
- **React Router DOM** - Client-side routing
- **TailwindCSS 4** - Utility-first CSS framework
- **shadcn/ui** - Beautiful and accessible UI components
- **Axios** - HTTP client for API requests
- **React Hook Form** - Form handling with validation
- **Zod** - TypeScript-first schema validation
- **Lucide React** - Beautiful icon library
- **Sonner** - Toast notifications

## 📁 Project Structure

```
client/
├── public/
│   ├── favicon.ico
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthLayout.jsx           # Authentication layout wrapper
│   │   │   └── LoginForm.jsx            # Login form component
│   │   ├── companies/
│   │   │   ├── CreateCompanyDialog.jsx  # Company creation modal
│   │   │   └── EditCompanyDialog.jsx    # Company editing modal
│   │   ├── layout/
│   │   │   └── Navbar.jsx               # Main navigation bar
│   │   ├── loans/
│   │   │   ├── LoanApplicationForm.jsx  # Loan application form
│   │   │   ├── LoanApprovalActions.jsx  # Loan approval buttons
│   │   │   └── LoanDetailsDialog.jsx    # Loan details modal
│   │   ├── reports/
│   │   │   └── ReportModal.jsx          # Reports and analytics modal
│   │   ├── settings/
│   │   │   ├── CompanySettings.jsx      # Company settings panel
│   │   │   ├── CreateUserDialog.jsx     # User creation modal
│   │   │   ├── EditUserDialog.jsx       # User editing modal
│   │   │   ├── SystemSettings.jsx       # System configuration
│   │   │   └── UserManagement.jsx       # User management interface
│   │   └── ui/
│   │       ├── avatar.jsx               # Avatar component (shadcn/ui)
│   │       ├── button.jsx               # Button component (shadcn/ui)
│   │       ├── card.jsx                 # Card component (shadcn/ui)
│   │       ├── dialog.jsx               # Dialog component (shadcn/ui)
│   │       ├── dropdown-menu.jsx        # Dropdown menu (shadcn/ui)
│   │       ├── form.jsx                 # Form components (shadcn/ui)
│   │       ├── input.jsx                # Input component (shadcn/ui)
│   │       ├── label.jsx                # Label component (shadcn/ui)
│   │       └── sonner.jsx               # Toast notifications
│   ├── lib/
│   │   └── utils.js                     # Utility functions (cn, etc.)
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.jsx            # Login page
│   │   ├── companies/
│   │   │   └── CompaniesPage.jsx        # Companies management page
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx        # Main dashboard
│   │   ├── loans/
│   │   │   └── LoansPage.jsx            # Loans management page
│   │   ├── reports/
│   │   │   └── ReportsPage.jsx          # Reports and analytics page
│   │   └── settings/
│   │       └── SettingsPage.jsx         # Settings and administration page
│   ├── services/
│   │   └── authService.js               # Authentication service
│   ├── store/
│   │   └── authStore.js                 # Authentication state store (empty)
│   ├── utils/
│   │   ├── api.js                       # Axios instance and interceptors
│   │   └── roleUtils.js                 # Role-based permission utilities
│   ├── App.css
│   ├── App.jsx                          # Main app component with routing
│   ├── index.css                        # Global styles and TailwindCSS
│   └── main.jsx                         # React app entry point
├── components.json                      # shadcn/ui configuration
├── eslint.config.js                     # ESLint configuration
├── index.html                           # Main HTML template
├── jsconfig.json                        # JavaScript configuration
├── package.json                         # Dependencies and scripts
├── pnpm-lock.yaml                       # Package lock file
├── README.md                            # This file
└── vite.config.js                       # Vite configuration
```

## ⚡ Quick Start

### 1. Install Dependencies

```bash
cd client
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the client directory:

```env
# API Configuration
VITE_API_URL=http://localhost:5000/api

# Optional: Enable development features
VITE_NODE_ENV=development
```

### 3. Start Development Server

```bash
# Development mode with hot reload
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Lint code
pnpm run lint
```

The development server will start on `http://localhost:5173`

## 🔐 Authentication System

### JWT Token Management

The frontend uses JWT tokens stored in `localStorage` for authentication:

```javascript
// Token storage key
const TOKEN_KEY = 'ndalamahub-token';

// Set token after login
localStorage.setItem(TOKEN_KEY, token);

// Get token for requests
const token = localStorage.getItem(TOKEN_KEY);

// Remove token on logout
localStorage.removeItem(TOKEN_KEY);
```

### Authentication Flow

```javascript
// src/services/authService.js
export const authService = {
    login: async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        const { token, user } = response.data;
        localStorage.setItem('ndalamahub-token', token);
        return user;
    },

    logout: () => {
        localStorage.removeItem('ndalamahub-token');
    }
};
```

### Automatic Token Attachment

All API requests automatically include the JWT token:

```javascript
// src/utils/api.js
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('ndalamahub-token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
```

## 🛡️ Role-Based Access Control

### Role Constants

```javascript
// src/utils/roleUtils.js
export const ROLES = {
    SUPER_USER: 'super_user',
    LENDER_ADMIN: 'lender_admin',
    CORPORATE_ADMIN: 'corporate_admin',
    CORPORATE_HR: 'corporate_hr',
    LENDER_USER: 'lender_user',
    CORPORATE_USER: 'corporate_user'
};
```

### Permission Utilities

The frontend includes comprehensive role-checking utilities:

```javascript
// Check if user can approve loans
export const canApproveLoan = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN,
        ROLES.CORPORATE_ADMIN,
        ROLES.CORPORATE_HR
    ].includes(role);
};

// Check if user can disburse loans
export const canDisburseLoan = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN
    ].includes(role);
};

// Get current user from JWT token
export const getCurrentUser = () => {
    const token = localStorage.getItem('ndalamahub-token');
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};
```

### UI Permission Patterns

Components use role-based rendering:

```jsx
// Example from LoanApprovalActions component
const currentUser = getCurrentUser();
const userRole = currentUser?.role;

return (
    <div className="flex space-x-2">
        {canApproveLoan(userRole) && (
            <Button onClick={() => onApprove(loan._id)}>
                Approve
            </Button>
        )}
        
        {canDisburseLoan(userRole) && loan.status === 'approved' && (
            <Button onClick={() => onDisburse(loan._id)}>
                Disburse
            </Button>
        )}
    </div>
);
```

## 🌐 API Integration

### Axios Configuration

```javascript
// src/utils/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Automatic token attachment
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('ndalamahub-token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
```

### API Usage Patterns

```javascript
// GET request example
const fetchLoans = async () => {
    try {
        const response = await api.get('/loans');
        setLoans(response.data.data.items);
    } catch (error) {
        console.error('Failed to fetch loans:', error);
    }
};

// POST request example
const createLoan = async (loanData) => {
    try {
        const response = await api.post('/loans', loanData);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to create loan');
    }
};

// PUT request example
const approveLoan = async (loanId, approvalData) => {
    try {
        const response = await api.put(`/loans/${loanId}/approve`, approvalData);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to approve loan');
    }
};
```

## 🎨 UI Components & Design System

### shadcn/ui Integration

The project uses shadcn/ui for consistent, accessible components:

```javascript
// components.json configuration
{
  "style": "new-york",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### Available UI Components

- **Button** - Various styles and sizes
- **Card** - Content containers
- **Dialog** - Modal dialogs
- **Form** - Form components with validation
- **Input** - Text inputs
- **Label** - Form labels
- **Avatar** - User avatars
- **Dropdown Menu** - Context menus
- **Sonner** - Toast notifications

### Custom Component Examples

```jsx
// Modal Dialog Example
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CreateUserDialog({ open, onClose, onSuccess }) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                {/* Form content */}
            </DialogContent>
        </Dialog>
    );
}

// Data Table Example
export function LoansTable({ loans, onRowClick }) {
    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Loan Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Applicant
                        </th>
                        {/* More columns */}
                    </tr>
                </thead>
                <tbody>
                    {loans.map((loan) => (
                        <tr key={loan._id} onClick={() => onRowClick(loan)}>
                            <td className="px-6 py-4">{loan.loanNumber}</td>
                            <td className="px-6 py-4">{loan.applicant.firstName} {loan.applicant.lastName}</td>
                            {/* More cells */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

## 📱 Page Structure & Routing

### Main App Routing

```jsx
// src/App.jsx
export function App() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/*" element={
                    <>
                        <Navbar />
                        <main className="pt-16 px-4">
                            <div className="max-w-7xl mx-auto">
                                <Routes>
                                    <Route path="/dashboard" element={<DashboardPage />} />
                                    <Route path="/companies" element={<CompaniesPage />} />
                                    <Route path="/loans" element={<LoansPage />} />
                                    <Route path="/reports" element={<ReportsPage />} />
                                    <Route path="/settings" element={<SettingsPage />} />
                                    <Route path="/" element={<Navigate to="/dashboard" />} />
                                </Routes>
                            </div>
                        </main>
                    </>
                } />
            </Routes>
        </div>
    );
}
```

### Page Components

#### Dashboard Page
- **Purpose**: Role-specific dashboard with statistics and quick actions
- **API Endpoints**: `/dashboard/stats`, `/dashboard/hr-stats`, `/dashboard/user-stats`
- **Role Variations**: Different dashboards for admin, HR, and regular users

#### Companies Page
- **Purpose**: Company management interface
- **API Endpoints**: `/companies` (GET, POST, PUT, DELETE)
- **Features**: Create, edit, delete companies with role restrictions

#### Loans Page
- **Purpose**: Loan management and application interface
- **API Endpoints**: `/loans` (GET, POST), `/loans/:id/approve`, `/loans/:id/reject`, `/loans/:id/disburse`
- **Features**: Apply, approve, reject, disburse loans based on user role

#### Reports Page
- **Purpose**: Analytics and reporting interface
- **API Endpoints**: `/reports/overview`, `/reports/active-loans`, `/reports/overdue-loans`
- **Features**: View statistics, generate reports, export data

#### Settings Page
- **Purpose**: User and system management
- **API Endpoints**: `/users` (CRUD), `/system/settings`
- **Features**: User management, company settings, system configuration

## 🔧 Backend Developer Integration Guide

### Required API Response Formats

The frontend expects consistent response formats from the backend:

#### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}
```

### Expected API Endpoints

The frontend makes requests to these endpoints:

#### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user profile

#### Dashboard
- `GET /dashboard/stats` - Admin dashboard statistics
- `GET /dashboard/hr-stats` - HR dashboard statistics  
- `GET /dashboard/user-stats` - User dashboard statistics

#### Users
- `GET /users` - Get users list (company-scoped)
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

#### Companies
- `GET /companies` - Get companies list
- `POST /companies` - Create new company
- `PUT /companies/:id` - Update company
- `DELETE /companies/:id` - Delete company

#### Loans
- `GET /loans` - Get loans list (role-filtered)
- `POST /loans` - Submit loan application
- `PUT /loans/:id/approve` - Approve loan
- `PUT /loans/:id/reject` - Reject loan
- `PUT /loans/:id/disburse` - Disburse loan

#### Reports
- `GET /reports/overview` - Overview statistics
- `GET /reports/active-loans` - Active loans report
- `GET /reports/overdue-loans` - Overdue loans report

### CORS Configuration

Backend must allow requests from the frontend:

```javascript
// Backend CORS configuration
const cors = require('cors');

app.use(cors({
    origin: ['http://localhost:5173', 'https://your-frontend-domain.com'],
    credentials: true
}));
```

### JWT Token Requirements

The frontend expects JWT tokens with this payload structure:

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

## 🎯 State Management Patterns

### Local State Management

Components use React's built-in state management:

```jsx
// useState for component state
const [users, setUsers] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

// useEffect for side effects
useEffect(() => {
    fetchUsers();
}, []);

const fetchUsers = async () => {
    setLoading(true);
    try {
        const response = await api.get('/users');
        setUsers(response.data.data);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
};
```

### Form State Management

Forms use React Hook Form with Zod validation:

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loanSchema = z.object({
    amount: z.number().min(1000, 'Minimum loan amount is K1,000'),
    purpose: z.string().min(10, 'Purpose must be at least 10 characters'),
    loanTerm: z.number().min(1).max(60, 'Loan term must be between 1-60 months')
});

export function LoanApplicationForm({ onSubmit }) {
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(loanSchema)
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <input
                {...register('amount', { valueAsNumber: true })}
                type="number"
                placeholder="Loan amount"
            />
            {errors.amount && <span>{errors.amount.message}</span>}
            
            <button type="submit">Submit Application</button>
        </form>
    );
}
```

## 🔍 Error Handling

### API Error Handling

```javascript
// Generic error handler
const handleApiError = (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    
    // Show toast notification
    toast.error(message);
    
    // Handle specific error codes
    if (error.response?.status === 401) {
        localStorage.removeItem('ndalamahub-token');
        window.location.href = '/login';
    }
    
    return message;
};

// Usage in components
const createUser = async (userData) => {
    try {
        const response = await api.post('/users', userData);
        toast.success('User created successfully');
        return response.data;
    } catch (error) {
        handleApiError(error);
        throw error;
    }
};
```

### Form Validation

```jsx
// Real-time validation feedback
export function CreateUserForm() {
    const [formData, setFormData] = useState({});
    const [errors, setErrors] = useState({});

    const validateField = (name, value) => {
        const newErrors = { ...errors };
        
        switch (name) {
            case 'email':
                if (!value.includes('@')) {
                    newErrors.email = 'Please enter a valid email';
                } else {
                    delete newErrors.email;
                }
                break;
            case 'password':
                if (value.length < 6) {
                    newErrors.password = 'Password must be at least 6 characters';
                } else {
                    delete newErrors.password;
                }
                break;
        }
        
        setErrors(newErrors);
    };

    return (
        <form>
            <input
                type="email"
                onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    validateField('email', e.target.value);
                }}
                className={errors.email ? 'border-red-500' : 'border-gray-300'}
            />
            {errors.email && <span className="text-red-500">{errors.email}</span>}
        </form>
    );
}
```

## 📊 Performance Considerations

### Code Splitting

```jsx
// Lazy load pages for better performance
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const LoansPage = lazy(() => import('./pages/loans/LoansPage'));

export function App() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/loans" element={<LoansPage />} />
            </Routes>
        </Suspense>
    );
}
```

### API Optimization

```javascript
// Debounced search
import { useMemo, useState, useEffect } from 'react';

export function useDebounced(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Usage in search components
export function UserSearch({ onSearch }) {
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounced(searchTerm, 300);

    useEffect(() => {
        if (debouncedSearchTerm) {
            onSearch(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, onSearch]);

    return (
        <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
        />
    );
}
```

## 🧪 Testing Guidelines

### Component Testing

```jsx
// Example test setup for components
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '../components/auth/LoginForm';

describe('LoginForm', () => {
    test('renders login form', () => {
        render(<LoginForm onSubmit={jest.fn()} />);
        
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    test('calls onSubmit with form data', () => {
        const mockSubmit = jest.fn();
        render(<LoginForm onSubmit={mockSubmit} />);
        
        fireEvent.change(screen.getByLabelText(/username/i), {
            target: { value: 'testuser' }
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
            target: { value: 'password123' }
        });
        fireEvent.click(screen.getByRole('button', { name: /login/i }));
        
        expect(mockSubmit).toHaveBeenCalledWith({
            username: 'testuser',
            password: 'password123'
        });
    });
});
```

### API Testing

```javascript
// Mock API calls for testing
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);

describe('API Integration', () => {
    beforeEach(() => {
        mock.reset();
    });

    test('login API call', async () => {
        const mockResponse = {
            token: 'fake-jwt-token',
            user: { id: '1', username: 'testuser', role: 'corporate_user' }
        };

        mock.onPost('/auth/login').reply(200, mockResponse);

        const result = await authService.login('testuser', 'password123');
        expect(result).toEqual(mockResponse.user);
    });
});
```

## 🚀 Deployment

### Build Configuration

```bash
# Build for production
pnpm run build

# Preview production build locally
pnpm run preview
```

### Environment Variables for Production

```env
# Production API URL
VITE_API_URL=https://api.ndalamahub.com/api

# Optional: Analytics or monitoring
VITE_ANALYTICS_ID=your-analytics-id
```

### Docker Deployment

```dockerfile
# Dockerfile for frontend
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy (if needed)
    location /api {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🛠️ Development Tools

### Available Scripts

```bash
pnpm run dev        # Start development server
pnpm run build      # Build for production
pnpm run preview    # Preview production build
pnpm run lint       # Run ESLint
```

### VS Code Extensions (Recommended)

- **ES7+ React/Redux/React-Native snippets** - Code snippets
- **Tailwind CSS IntelliSense** - TailwindCSS autocomplete
- **Auto Rename Tag** - Automatically rename paired tags
- **Bracket Pair Colorizer** - Colorize matching brackets
- **GitLens** - Git integration
- **Thunder Client** - API testing

### Browser DevTools

The app includes development-friendly features:

- React DevTools support
- Console logging for API calls
- Error boundaries for graceful error handling
- Hot module replacement for fast development

## 📞 Backend Integration Checklist

When working with this frontend, backend developers should ensure:

### ✅ API Requirements
- [ ] CORS configured for `http://localhost:5173` (development)
- [ ] JWT tokens include required payload fields (`id`, `username`, `role`, `company`)
- [ ] Consistent response format (success/error structure)
- [ ] Proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- [ ] Role-based access control implemented
- [ ] Company-scoped data filtering for multi-tenant operations

### ✅ Endpoint Requirements
- [ ] All expected endpoints implemented and documented
- [ ] Request validation and sanitization
- [ ] Proper error messages for client-side display
- [ ] Pagination support for list endpoints
- [ ] Search and filtering capabilities

### ✅ Security Requirements
- [ ] JWT token validation and expiration handling
- [ ] Rate limiting for sensitive endpoints
- [ ] Input validation and SQL injection prevention
- [ ] XSS protection
- [ ] HTTPS in production

### ✅ Data Requirements
- [ ] Consistent field naming (camelCase vs snake_case)
- [ ] Date formatting (ISO 8601 recommended)
- [ ] Currency handling (numeric values)
- [ ] Boolean values for status fields
- [ ] Proper relationship population (user details, company info)

## 📈 Monitoring & Analytics

### Error Tracking

The frontend includes basic error tracking:

```javascript
// Global error handler
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    // Send to monitoring service in production
});

// React error boundary
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('React error boundary caught an error:', error, errorInfo);
        // Send to monitoring service in production
    }

    render() {
        if (this.state.hasError) {
            return <h1>Something went wrong.</h1>;
        }

        return this.props.children;
    }
}
```

---

**Documentation Version**: 2.48  
**Last Updated**: August 31, 2025  
**Frontend Version**: 1.0.0

This frontend is designed to work seamlessly with the NdalamaHub Backend API. For backend API documentation, refer to the server README.md file.
