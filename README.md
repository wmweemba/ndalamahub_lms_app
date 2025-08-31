# NdalamaHub LMS - Loan Management System

<div align="center">
  <h3>A comprehensive loan management system for lenders and corporate clients</h3>
  
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
  [![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-green.svg)](https://www.mongodb.com/)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](#)
</div>

## 🌟 Overview

NdalamaHub LMS is a modern, full-stack loan management system designed for financial institutions and corporate clients. It provides a comprehensive platform for managing loan applications, approvals, disbursements, and repayments with role-based access control and multi-tenant architecture.

### Key Features

- **🔐 Multi-Role Authentication** - 6 distinct user roles with hierarchical permissions
- **🏢 Multi-Tenant Architecture** - Support for multiple lenders and corporate clients
- **💰 Complete Loan Lifecycle** - From application to repayment
- **📊 Real-Time Analytics** - Role-specific dashboards and reporting
- **📄 Export Capabilities** - PDF and Excel report generation
- **🛡️ Enterprise Security** - JWT authentication with role-based access control
- **📱 Responsive Design** - Modern, mobile-friendly interface
- **⚡ High Performance** - Built with modern tech stack for scalability

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (v5.0 or higher)
- **pnpm** (v7 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wmweemba/ndalamahub_lms_app.git
   cd ndalamahub_lms_app
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   pnpm install
   
   # Install client dependencies
   cd client && pnpm install
   
   # Install server dependencies
   cd ../server && pnpm install
   ```

3. **Environment Configuration**

   Create `.env` file in the server directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/ndalamahub
   # Or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/ndalamahub
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
   
   # Optional: Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

   Create `.env` file in the client directory:
   ```env
   # API Configuration
   VITE_API_URL=http://localhost:5000/api
   VITE_NODE_ENV=development
   ```

4. **Database Setup**
   ```bash
   # From server directory
   cd server
   pnpm run seed
   ```

5. **Start the Application**
   ```bash
   # From root directory - starts both client and server
   pnpm start
   
   # Or start individually:
   # Client: http://localhost:5173
   pnpm run client
   
   # Server: http://localhost:5000
   pnpm run server
   ```

### Default Login Credentials

After seeding, use these credentials to access the system:

| Role | Username | Password | Description |
|------|----------|----------|-------------|
| Super User | `superadmin` | `Admin@2025` | Full system access |
| Lender Admin | `manager` | `Manager@2025` | Lender portfolio management |
| Corporate HR | `hr_sarah` | `HR@2025` | Employee loan oversight |
| Corporate Admin | `david_admin` | `Corporate@2025` | Company administration |

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express API    │    │    MongoDB      │
│                 │    │                 │    │                 │
│  • React 19     │◄──►│  • Node.js      │◄──►│  • User Data    │
│  • Vite         │    │  • Express 4.x  │    │  • Companies    │
│  • TailwindCSS  │    │  • JWT Auth     │    │  • Loans        │
│  • shadcn/ui    │    │  • Role-based   │    │  • Reports      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Project Structure

```
ndalamahub_lms_app/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── utils/            # Utility functions
│   │   └── lib/              # Shared libraries
│   ├── public/               # Static assets
│   └── package.json
│
├── server/                   # Node.js Backend
│   ├── config/              # Database configuration
│   ├── constants/           # Application constants
│   ├── middleware/          # Express middleware
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── utils/              # Server utilities
│   └── package.json
│
├── package.json            # Root package.json
└── README.md              # This file
```

## 👥 User Roles & Permissions

The system implements a hierarchical role-based access control:

### Role Hierarchy (Highest → Lowest)

1. **Super User** (`super_user`) - Level 5
   - 🔧 Full system administration
   - 🏢 Manage all companies and users
   - ⚙️ Configure system-wide settings

2. **Lender Admin** (`lender_admin`) - Level 4
   - 🏦 Manage lending operations
   - 🤝 Create corporate client companies
   - 💰 Disburse and manage loans

3. **Corporate Admin** (`corporate_admin`) - Level 3
   - 🏢 Manage company operations
   - 📊 Access company-wide reports
   - 👥 Manage company users

4. **Corporate HR** (`corporate_hr`) - Level 2
   - ✅ Approve/reject loan applications
   - 👨‍💼 Manage employee records
   - 📈 Access HR dashboards

5. **Lender User** (`lender_user`) - Level 1
   - 📄 Process loan applications
   - 💳 Handle payments
   - 📋 Generate basic reports

6. **Corporate User** (`corporate_user`) - Level 0
   - 📝 Submit loan applications
   - 👀 View personal loan status
   - 💰 Make loan payments

## 🛠️ Technology Stack

### Frontend
- **React 19** - Latest React with concurrent features
- **Vite** - Fast build tool and dev server
- **TailwindCSS 4** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible components
- **React Router DOM** - Client-side routing
- **Axios** - HTTP client
- **React Hook Form** - Form management
- **Zod** - Schema validation

### Backend
- **Node.js 18+** - JavaScript runtime
- **Express 4.x** - Web framework
- **MongoDB 5.0+** - NoSQL database
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **PDFKit** - PDF generation
- **ExcelJS** - Excel file generation

### Development Tools
- **pnpm** - Fast package manager
- **ESLint** - Code linting
- **Nodemon** - Development server
- **Concurrently** - Run multiple commands

## 📚 API Documentation

The system provides comprehensive REST APIs:

### Base URL
```
http://localhost:5000/api
```

### Authentication
```bash
# Login
POST /api/auth/login
{
  "username": "superadmin",
  "password": "Admin@2025"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f5d8b8e1234567890abcde",
    "username": "superadmin",
    "role": "super_user"
  }
}
```

### Core Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| **Authentication** |
| POST | `/auth/login` | Public | User authentication |
| POST | `/auth/register` | Public | User registration |
| GET | `/auth/me` | Private | Current user profile |
| **User Management** |
| GET | `/users` | HR+ | List users (company-scoped) |
| POST | `/users` | HR+ | Create new user |
| PUT | `/users/:id` | Private | Update user |
| DELETE | `/users/:id` | HR+ | Delete user |
| **Company Management** |
| GET | `/companies` | Private | List companies (role-filtered) |
| POST | `/companies` | Admin+ | Create company |
| PUT | `/companies/:id` | Admin+ | Update company |
| **Loan Management** |
| GET | `/loans` | Private | List loans (role-filtered) |
| POST | `/loans` | User+ | Submit application |
| PUT | `/loans/:id/approve` | HR+ | Approve loan |
| PUT | `/loans/:id/disburse` | Lender+ | Disburse funds |
| **Dashboard & Reports** |
| GET | `/dashboard/stats` | Admin+ | Dashboard statistics |
| GET | `/reports/active-loans` | HR+ | Active loans report |
| GET | `/reports/export/:format` | HR+ | Export reports |

For complete API documentation, see:
- [Backend API Documentation](server/README-BACKEND.md)
- [Frontend Integration Guide](client/README-FRONTEND.md)

## 💡 Key Features

### 🔐 Multi-Tenant Security
- JWT-based authentication with role hierarchy
- Company-scoped data access
- Role-based UI component rendering
- Secure API endpoints with middleware protection

### 📊 Comprehensive Dashboards
- **Super User**: System-wide analytics and management
- **Lender Admin**: Portfolio management and disbursement tracking
- **Corporate HR**: Employee loan oversight and approval workflows
- **Corporate User**: Personal loan dashboard and application status

### 💰 Complete Loan Lifecycle
1. **Application** - Corporate users submit loan requests
2. **Review** - HR users review and validate applications
3. **Approval** - Authorized users approve/reject with comments
4. **Disbursement** - Lender admins release approved funds
5. **Repayment** - Track payments and installment schedules

### 📈 Advanced Reporting
- Real-time loan statistics and analytics
- Exportable reports in PDF and Excel formats
- Role-based data filtering and access control
- Visual charts and data representations

### 🏢 Company Management
- Multi-company support for lenders and corporates
- Company-specific user management
- Relationship mapping between lenders and corporate clients
- Configurable company settings and policies

## 🔧 Development

### Development Scripts

```bash
# Root directory
pnpm start          # Start both client and server
pnpm run client     # Start frontend only
pnpm run server     # Start backend only

# Client directory
pnpm run dev        # Development server
pnpm run build      # Production build
pnpm run preview    # Preview build
pnpm run lint       # Lint code

# Server directory
pnpm run dev        # Development with nodemon
pnpm start          # Production server
pnpm run seed       # Seed database
```

### Environment Setup

1. **Database Setup**
   ```bash
   # Local MongoDB
   mongod --dbpath /data/db
   
   # Or use MongoDB Atlas for cloud database
   ```

2. **Development Workflow**
   ```bash
   # Terminal 1: Start development servers
   pnpm start
   
   # Terminal 2: Monitor logs
   cd server && pnpm run dev
   
   # Terminal 3: Frontend development
   cd client && pnpm run dev
   ```

### Code Quality

- **ESLint** configuration for consistent code style
- **Git hooks** for pre-commit validation
- **Environment** separation for development/production
- **Error handling** with comprehensive logging

## 🚀 Deployment

### Production Build

```bash
# Build frontend
cd client
pnpm run build

# Start production server
cd ../server
NODE_ENV=production pnpm start
```

### Environment Variables

**Production Server (.env)**
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ndalamahub
JWT_SECRET=your-production-secret-32-characters-minimum
CORS_ORIGIN=https://your-domain.com
```

**Production Client (.env)**
```env
VITE_API_URL=https://api.your-domain.com/api
```

### Docker Deployment (Optional)

```dockerfile
# Dockerfile example for backend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Security Checklist

- [ ] Environment variables properly configured
- [ ] JWT secret is strong (32+ characters)
- [ ] MongoDB Atlas with IP whitelist
- [ ] CORS origins restricted to your domain
- [ ] HTTPS certificates configured
- [ ] Rate limiting enabled
- [ ] Input validation and sanitization
- [ ] Error logging and monitoring

## 📖 Documentation

- **[Backend API Guide](server/README-BACKEND.md)** - Complete backend documentation
- **[Frontend Integration Guide](client/README-FRONTEND.md)** - Frontend development guide
- **[Changelog](changelog.md)** - Version history and updates

## 🧪 Testing

### Manual Testing

1. **Authentication Flow**
   ```bash
   # Test login with different roles
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"superadmin","password":"Admin@2025"}'
   ```

2. **API Endpoints**
   - Use tools like Postman, Insomnia, or Thunder Client
   - Test with different user roles and permissions
   - Verify company-scoped data access

3. **Frontend Testing**
   - Test responsive design on different devices
   - Verify role-based UI rendering
   - Test form validation and error handling

### Automated Testing (Planned)

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style and patterns
- Add comments for complex logic
- Update documentation for new features
- Test thoroughly before submitting PR
- Use meaningful commit messages

## 🐛 Troubleshooting

### Common Issues

**1. MongoDB Connection Failed**
```bash
# Check MongoDB service
# Windows: net start MongoDB
# Mac/Linux: sudo systemctl start mongod

# Verify connection string
echo $MONGODB_URI
```

**2. JWT Token Issues**
```bash
# Verify JWT secret is set
echo $JWT_SECRET

# Check token format in browser localStorage
```

**3. CORS Errors**
```javascript
// Verify CORS configuration in server.js
app.use(cors({
  origin: ['http://localhost:5173', 'your-domain.com']
}));
```

**4. Port Conflicts**
```bash
# Check if ports are in use
lsof -i :5000  # Backend port
lsof -i :5173  # Frontend port

# Kill processes if needed
kill -9 <PID>
```

### Debug Mode

Enable detailed logging:
```env
NODE_ENV=development
DEBUG=app:*
```

## 📊 Monitoring & Analytics

### Application Metrics

- User registration and login patterns
- Loan application volume and approval rates
- System performance and response times
- Error rates and common issues

### Business Intelligence

- Dashboard provides real-time insights
- Exportable reports for stakeholder analysis
- Role-based analytics for different user types
- Company performance tracking

## 🔮 Roadmap

### Version 1.1 (Planned)
- [ ] Enhanced reporting with more chart types
- [ ] Email notifications for loan status changes
- [ ] Mobile app development
- [ ] Advanced user permissions

### Version 1.2 (Future)
- [ ] Integration with payment gateways
- [ ] Credit scoring system
- [ ] Document management
- [ ] API rate limiting dashboard

### Version 2.0 (Vision)
- [ ] Machine learning for risk assessment
- [ ] Advanced analytics and predictions
- [ ] Multi-language support
- [ ] White-label customization

## 📞 Support

### Getting Help

- **Documentation**: Comprehensive guides in `/docs` directory
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Join community discussions
- **Email**: Contact support team

### Resources

- [API Documentation](server/README-BACKEND.md)
- [Frontend Guide](client/README-FRONTEND.md)
- [Deployment Guide](#-deployment)
- [Contributing Guidelines](#-contributing)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **shadcn/ui** for the beautiful UI components
- **React Team** for the amazing framework
- **Node.js Community** for the robust ecosystem
- **MongoDB** for the flexible database solution

---

<div align="center">
  <p>Built with ❤️ by the NdalamaHub Team</p>
  <p>
    <a href="#-overview">Back to Top</a> •
    <a href="server/README-BACKEND.md">Backend Docs</a> •
    <a href="client/README-FRONTEND.md">Frontend Docs</a>
  </p>
</div>
