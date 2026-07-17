import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import { getCurrentUser } from '@/utils/roleUtils';
import { User, Mail, Phone, Shield, Building2, Key, Eye, EyeOff } from 'lucide-react';

const SELECT_CLASSES =
  'w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm';

export default function EditUserDialog({ user, onClose, onUserUpdated }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'borrower',
    company: user.company?._id || user.company || '',
    department: user.department || '',
    employeeId: user.employeeId || '',
    isActive: user.isActive !== undefined ? user.isActive : true
  });

  useEffect(() => {
    try {
      // Get current user
      const userData = getCurrentUser();
      setCurrentUser(userData);

      fetchCompanies();
    } catch (error) {
      console.error('EditUserDialog - Error in useEffect:', error);
      setError('Failed to initialize dialog');
    }
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      // Companies API returns companies array directly in response.data
      setCompanies(response.data || []);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
      setError('Failed to load companies. Please try again.');
      setCompanies([]); // Set empty array on error
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Validate that employer-side users can only edit users within their company
      if ((currentUser?.role === 'employer_admin' || currentUser?.role === 'employer_hr') &&
          user.company && (currentUser.company?._id || currentUser.company) !== user.company._id) {
        setError('You can only edit users within your company');
        return;
      }

      const response = await api.put(`/users/${user._id}`, formData);

      if (response.data.success) {
        toast.success('User updated');
        onUserUpdated(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
      console.error('Update user error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePasswordReset = async () => {
    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setPasswordResetLoading(true);
      setError(null);

      const response = await api.patch(`/users/${user._id}/reset-password`, {
        newPassword: newPassword
      });

      if (response.data.success) {
        toast.success('Password reset successfully');
        setNewPassword('');
        setShowPasswordReset(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
      console.error('Password reset error:', err);
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const canResetPassword = () => {
    if (!currentUser) return false;

    // Only admins can reset passwords, and not their own
    const isAdmin = ['platform_admin', 'lender_admin', 'employer_admin'].includes(currentUser.role);
    const isNotSelf = user._id !== (currentUser.id || currentUser._id);

    return isAdmin && isNotSelf;
  };

  const getAvailableRoles = () => {
    const allRoles = [
      { value: 'platform_admin', label: 'Platform Admin', description: 'System administration' },
      { value: 'lender_admin', label: 'Lender Admin', description: 'Lender administration' },
      { value: 'employer_admin', label: 'Employer Admin', description: 'Company administration' },
      { value: 'employer_hr', label: 'Employer HR', description: 'HR management access' },
      { value: 'lender_officer', label: 'Lender Officer', description: 'Lender employee access' },
      { value: 'borrower', label: 'Borrower', description: 'Basic employee access' }
    ];

    // Return basic roles if currentUser is not loaded yet
    if (!currentUser) {
      return [{ value: 'borrower', label: 'Borrower', description: 'Basic employee access' }];
    }

    // Platform admin can assign any role
    if (currentUser.role === 'platform_admin') {
      return allRoles;
    }

    // Lender admin can assign all roles except platform_admin
    if (currentUser.role === 'lender_admin') {
      return allRoles.filter(role => role.value !== 'platform_admin');
    }

    // Employer admin and HR can only assign employer-side roles
    if (currentUser.role === 'employer_admin' || currentUser.role === 'employer_hr') {
      return allRoles.filter(role =>
        ['employer_admin', 'employer_hr', 'borrower'].includes(role.value)
      );
    }

    // Other roles cannot assign any roles
    return [];
  };

  const roleOptions = getAvailableRoles();

  // Safety check to prevent rendering with invalid data
  if (!user || !user._id) {
    console.error('EditUserDialog - Invalid user data:', user);
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base font-medium">
            <User className="w-4 h-4 mr-2 text-muted-foreground" />
            Edit user — {user.firstName} {user.lastName}
          </DialogTitle>
        </DialogHeader>

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
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className={`${SELECT_CLASSES} mt-1`}
                >
                  {roleOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {roleOptions.find(option => option.value === formData.role)?.description}
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
                  disabled={currentUser?.role === 'employer_admin' || currentUser?.role === 'employer_hr'}
                  className={`${SELECT_CLASSES} mt-1 disabled:bg-muted disabled:cursor-not-allowed`}
                >
                  <option value="">Select company</option>
                  {companies.map(company => (
                    <option key={company._id} value={company._id}>
                      {company.name} ({company.type})
                    </option>
                  ))}
                </select>
                {(currentUser?.role === 'employer_admin' || currentUser?.role === 'employer_hr') && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You can only edit users within your company
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

              <div className="sm:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="ml-2 text-sm text-foreground">Account is active</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Inactive users cannot log in to the system
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Password Reset Section */}
        {canResetPassword() && (
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-medium text-foreground mb-3 sm:mb-4 flex items-center">
              <Key className="w-4 h-4 mr-2 text-status-danger-fg" />
              Password reset
            </h3>

            {!showPasswordReset ? (
              <div className="bg-status-warning-bg rounded-2xl p-4">
                <p className="text-sm text-status-warning-fg mb-3">
                  Reset this user's password. The user will need to use the new password to log in.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPasswordReset(true)}
                  className="flex items-center text-status-danger-fg border-status-danger-fg/30 hover:bg-status-danger-bg"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Reset password
                </Button>
              </div>
            ) : (
              <div className="bg-status-danger-bg rounded-2xl p-4 space-y-4">
                <div>
                  <Label htmlFor="newPassword">New password *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={passwordResetLoading || !newPassword.trim()}
                    className="bg-status-danger-fg hover:bg-status-danger-fg/90 text-white flex items-center justify-center"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    {passwordResetLoading ? 'Resetting...' : 'Confirm reset'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordReset(false);
                      setNewPassword('');
                      setError(null);
                    }}
                    disabled={passwordResetLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

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
            {loading ? 'Updating...' : 'Update user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
