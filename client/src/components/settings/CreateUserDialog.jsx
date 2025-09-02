import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import { User, Mail, Phone, Shield, Building2 } from 'lucide-react';

export default function CreateUserDialog({ onClose, onUserCreated }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'corporate_user',
    company: '',
    department: '',
    employeeId: ''
  });

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        const user = response.data.data.user;
        console.log('Current user from /auth/me:', user);
        setCurrentUser(user);
        fetchCompanies(user);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      setError('Failed to load user data. Please try again.');
    }
  };

  const fetchCompanies = async (user) => {
    try {
      const response = await api.get('/companies');
      // Companies API returns companies array directly in response.data
      console.log('Fetched companies:', response.data);
      setCompanies(response.data || []);
      
      // Pre-select current user's company for corporate roles after companies are fetched
      if (user && (user.role === 'corporate_hr' || user.role === 'corporate_admin')) {
        // The user object from /auth/me has a populated company object
        const companyId = user.company?._id || user.company || '';
        console.log('User from /auth/me:', user);
        console.log('User company from /auth/me:', user.company);
        console.log('Company ID to set:', companyId);
        console.log('Available companies:', response.data);
        
        // Verify the company exists in the fetched companies
        const matchingCompany = response.data?.find(company => company._id === companyId);
        console.log('Matching company found:', matchingCompany);
        
        if (companyId) {
          setFormData(prev => ({
            ...prev,
            company: companyId
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
      setError('Failed to load companies. Please try again.');
      setCompanies([]); // Set empty array on error
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { confirmPassword, ...userData } = formData;
      console.log('Submitting user data:', userData);
      console.log('Current user:', currentUser);
      
      const response = await api.post('/users', userData);

      if (response.data.success) {
        onUserCreated(response.data.data);
      }
    } catch (err) {
      console.error('Create user error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const roleOptions = [
    { value: 'corporate_user', label: 'Corporate User', description: 'Basic employee access' },
    { value: 'corporate_hr', label: 'Corporate HR', description: 'HR management access' },
    { value: 'corporate_admin', label: 'Corporate Admin', description: 'Company administration' },
    { value: 'lender_user', label: 'Lender User', description: 'Lender employee access' },
    { value: 'lender_admin', label: 'Lender Admin', description: 'Lender administration' },
    { value: 'super_user', label: 'Super User', description: 'System administration' }
  ];

  // Filter role options based on current user's role
  const getAvailableRoles = () => {
    if (!currentUser) return roleOptions;
    
    if (currentUser.role === 'corporate_hr') {
      // Corporate HR can only create corporate_user and corporate_hr roles
      return roleOptions.filter(role => ['corporate_user', 'corporate_hr'].includes(role.value));
    } else if (currentUser.role === 'corporate_admin') {
      // Corporate admin can create corporate roles but not lender roles
      return roleOptions.filter(role => ['corporate_user', 'corporate_hr', 'corporate_admin'].includes(role.value));
    }
    
    // Other roles get all options (lender_admin, super_user)
    return roleOptions;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg sm:text-xl">
            <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
            Create New User
          </DialogTitle>
        </DialogHeader>

        {/* Loading state while currentUser is being fetched */}
        {currentUser === null ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 sm:p-4 text-sm">
                  {error}
                </div>
              )}

          {/* Personal Information */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
              <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 mr-1" />
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 mr-1" />
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee ID
                </label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
              Account Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {getAvailableRoles().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {roleOptions.find(option => option.value === formData.role)?.description}
                  {currentUser && (currentUser.role === 'corporate_hr' || currentUser.role === 'corporate_admin') && (
                    <span className="block mt-1 text-xs text-blue-600">
                      You can only create {currentUser.role === 'corporate_hr' ? 'corporate user and HR' : 'corporate'} roles.
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="w-4 h-4 mr-1" />
                  Company *
                </label>
                <select
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  disabled={currentUser && (currentUser.role === 'corporate_hr' || currentUser.role === 'corporate_admin')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                >
                  <option value="">Select Company</option>
                  {companies.length === 0 ? (
                    <option value="" disabled>No companies available</option>
                  ) : (
                    companies
                      .filter(company => {
                        // For corporate users, only show their own company
                        if (currentUser && (currentUser.role === 'corporate_hr' || currentUser.role === 'corporate_admin')) {
                          const userCompanyId = currentUser.company?._id || currentUser.company;
                          return company._id === userCompanyId;
                        }
                        // For other roles, show all companies
                        return true;
                      })
                      .map(company => (
                        <option key={company._id} value={company._id}>
                          {company.name} ({company.type})
                        </option>
                      ))
                  )}
                </select>
                {currentUser && (currentUser.role === 'corporate_hr' || currentUser.role === 'corporate_admin') && (
                  <p className="text-xs text-gray-500 mt-1">
                    You can only create users within your own company.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Human Resources, Finance, IT"
                />
              </div>
            </div>
          </div>
            </form>

            <DialogFooter className="pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto order-1 sm:order-2 mb-2 sm:mb-0"
              >
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
