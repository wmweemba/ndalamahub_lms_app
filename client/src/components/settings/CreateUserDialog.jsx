import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/utils/api';
import { User, Mail, Phone, Shield, Building2 } from 'lucide-react';

const SELECT_CLASSES =
  'w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm';

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
    role: 'borrower',
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
      setCompanies(response.data || []);

      // Pre-select current user's company for employer roles after companies are fetched
      if (user && (user.role === 'employer_hr' || user.role === 'employer_admin')) {
        // The user object from /auth/me has a populated company object
        const companyId = user.company?._id || user.company || '';

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

      const { confirmPassword: _confirmPassword, ...userData } = formData;

      const response = await api.post('/users', userData);

      if (response.data.success) {
        onUserCreated(response.data.data);
      }
    } catch (err) {
      console.error('Create user error:', err);
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
    { value: 'borrower', label: 'Borrower', description: 'Basic employee access' },
    { value: 'employer_hr', label: 'Employer HR', description: 'HR management access' },
    { value: 'employer_admin', label: 'Employer Admin', description: 'Company administration' },
    { value: 'lender_officer', label: 'Lender Officer', description: 'Lender employee access' },
    { value: 'lender_admin', label: 'Lender Admin', description: 'Lender administration' },
    { value: 'platform_admin', label: 'Platform Admin', description: 'System administration' }
  ];

  // Filter role options based on current user's role
  const getAvailableRoles = () => {
    if (!currentUser) return roleOptions;

    if (currentUser.role === 'employer_hr') {
      // Employer HR can only create borrower and employer_hr roles
      return roleOptions.filter(role => ['borrower', 'employer_hr'].includes(role.value));
    } else if (currentUser.role === 'employer_admin') {
      // Employer admin can create employer-side roles but not lender roles
      return roleOptions.filter(role => ['borrower', 'employer_hr', 'employer_admin'].includes(role.value));
    }

    // Other roles get all options (lender_admin, platform_admin)
    return roleOptions;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base font-medium">
            <User className="w-4 h-4 mr-2 text-muted-foreground" />
            Create new user
          </DialogTitle>
        </DialogHeader>

        {/* Loading state while currentUser is being fetched */}
        {currentUser === null ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {error && (
                <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 sm:p-4 text-sm">
                  {error}
                </div>
              )}

          {/* Personal Information */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 sm:mb-4 flex items-center">
              <User className="w-4 h-4 mr-2 text-muted-foreground" />
              Personal information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last name *</Label>
                <Input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email" className="flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  Phone *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 sm:mb-4 flex items-center">
              <Shield className="w-4 h-4 mr-2 text-muted-foreground" />
              Account information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className={`${SELECT_CLASSES} mt-1`}
                >
                  {getAvailableRoles().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {roleOptions.find(option => option.value === formData.role)?.description}
                  {currentUser && (currentUser.role === 'employer_hr' || currentUser.role === 'employer_admin') && (
                    <span className="block mt-1 text-xs text-status-info-fg">
                      You can only create {currentUser.role === 'employer_hr' ? 'borrower and HR' : 'employer-side'} roles.
                    </span>
                  )}
                </p>
              </div>

              <div>
                <Label htmlFor="company" className="flex items-center">
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  Company *
                </Label>
                <select
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  disabled={currentUser && (currentUser.role === 'employer_hr' || currentUser.role === 'employer_admin')}
                  className={`${SELECT_CLASSES} mt-1 disabled:bg-muted disabled:cursor-not-allowed`}
                >
                  <option value="">Select company</option>
                  {companies.length === 0 ? (
                    <option value="" disabled>No companies available</option>
                  ) : (
                    companies
                      .filter(company => {
                        // For employer-side users, only show their own company
                        if (currentUser && (currentUser.role === 'employer_hr' || currentUser.role === 'employer_admin')) {
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
                {currentUser && (currentUser.role === 'employer_hr' || currentUser.role === 'employer_admin') && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You can only create users within your own company.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Human Resources, Finance, IT"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
            </form>

            <DialogFooter className="pt-4 border-t border-border">
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
                className="w-full sm:w-auto order-1 sm:order-2 mb-2 sm:mb-0"
              >
                {loading ? 'Creating...' : 'Create user'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
