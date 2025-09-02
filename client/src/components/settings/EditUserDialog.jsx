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
import { getCurrentUser } from '@/utils/roleUtils';
import { User, Mail, Phone, Shield, Building2 } from 'lucide-react';

export default function EditUserDialog({ user, onClose, onUserUpdated }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'corporate_user',
    company: user.company?._id || user.company || '',
    department: user.department || '',
    employeeId: user.employeeId || '',
    isActive: user.isActive !== undefined ? user.isActive : true
  });

  useEffect(() => {
    // Get current user
    const userData = getCurrentUser();
    setCurrentUser(userData);
    
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      // Companies API returns companies array directly in response.data
      console.log('Fetched companies:', response.data);
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

      // Validate that corporate users can only edit users within their company
      if ((currentUser?.role === 'corporate_admin' || currentUser?.role === 'corporate_hr') && 
          user.company && (currentUser.company?._id || currentUser.company) !== user.company._id) {
        setError('You can only edit users within your company');
        return;
      }

      const response = await api.put(`/users/${user._id}`, formData);

      if (response.data.success) {
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

  const getAvailableRoles = () => {
    const allRoles = [
      { value: 'super_user', label: 'Super User', description: 'System administration' },
      { value: 'lender_admin', label: 'Lender Admin', description: 'Lender administration' },
      { value: 'corporate_admin', label: 'Corporate Admin', description: 'Company administration' },
      { value: 'corporate_hr', label: 'Corporate HR', description: 'HR management access' },
      { value: 'lender_user', label: 'Lender User', description: 'Lender employee access' },
      { value: 'corporate_user', label: 'Corporate User', description: 'Basic employee access' }
    ];

    // Super user can assign any role
    if (currentUser.role === 'super_user') {
      return allRoles;
    }

    // Lender admin can assign all roles except super_user
    if (currentUser.role === 'lender_admin') {
      return allRoles.filter(role => role.value !== 'super_user');
    }

    // Corporate admin and HR can only assign corporate roles
    if (currentUser.role === 'corporate_admin' || currentUser.role === 'corporate_hr') {
      return allRoles.filter(role => 
        ['corporate_admin', 'corporate_hr', 'corporate_user'].includes(role.value)
      );
    }

    // Other roles cannot assign any roles
    return [];
  };

  const roleOptions = getAvailableRoles();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg sm:text-xl">
            <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
            Edit User: {user.firstName} {user.lastName}
          </DialogTitle>
        </DialogHeader>

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
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {roleOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {roleOptions.find(option => option.value === formData.role)?.description}
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
                  disabled={currentUser.role === 'corporate_admin' || currentUser.role === 'corporate_hr'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                >
                  <option value="">Select Company</option>
                  {companies.map(company => (
                    <option key={company._id} value={company._id}>
                      {company.name} ({company.type})
                    </option>
                  ))}
                </select>
                {(currentUser.role === 'corporate_admin' || currentUser.role === 'corporate_hr') && (
                  <p className="text-xs text-gray-500 mt-1">
                    You can only edit users within your company
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

              <div className="sm:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Account is active</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Inactive users cannot log in to the system
                </p>
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
            {loading ? 'Updating...' : 'Update User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
