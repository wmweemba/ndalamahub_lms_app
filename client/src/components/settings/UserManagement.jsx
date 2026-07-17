import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import CreateUserDialog from './CreateUserDialog';
import EditUserDialog from './EditUserDialog';
import { Plus, Edit, Trash2, Search, Users, Mail, Phone } from 'lucide-react';

// Canonical role -> pill tint mapping for this surface, UI_SPEC §17 Step 2. Reuse this map
// wherever a role badge is needed on Settings/User Management surfaces.
const ROLE_TINT_CLASSES = {
  platform_admin: 'bg-status-info-bg text-status-info-fg',
  lender_admin: 'bg-[#7E78D2]/15 text-[#3C3489]',
  lender_officer: 'bg-[#7E78D2]/15 text-[#3C3489]',
  employer_admin: 'bg-status-success-bg/70 text-status-success-fg',
  employer_hr: 'bg-status-success-bg/70 text-status-success-fg',
  borrower: 'bg-[#F0F0EE] text-[#5F5E5A]',
};

const SELECT_CLASSES =
  'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setCurrentUser(response.data.data.user);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (err) {
      setError('Failed to load users');
      console.error('Users fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/users/${userId}`);
      if (response.data.success) {
        setUsers(users.filter(user => user._id !== userId));
        toast.success('User deleted');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
      console.error('Delete user error:', err);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await api.patch(`/users/${userId}/status`, {
        isActive: !currentStatus
      });
      if (response.data.success) {
        setUsers(users.map(user =>
          user._id === userId
            ? { ...user, isActive: !currentStatus }
            : user
        ));
        toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status');
      console.error('Toggle user status error:', err);
    }
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      'platform_admin': 'Platform Admin',
      'lender_admin': 'Lender Admin',
      'lender_officer': 'Lender Officer',
      'employer_admin': 'Employer Admin',
      'employer_hr': 'Employer HR',
      'borrower': 'Borrower'
    };
    return roleNames[role] || role;
  };

  const canEditUser = (user) => {
    if (!currentUser) return false;

    const roleHierarchy = {
      'platform_admin': 6,
      'lender_admin': 5,
      'lender_officer': 4,
      'employer_admin': 3,
      'employer_hr': 2,
      'borrower': 1
    };

    // Can't edit yourself
    if (user._id === currentUser._id) return false;

    // Can only edit users with lower role hierarchy
    return roleHierarchy[currentUser.role] > roleHierarchy[user.role];
  };

  const canDeleteUser = (user) => {
    return canEditUser(user) && user._id !== currentUser._id;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && user.isActive) ||
      (statusFilter === 'inactive' && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-base font-medium text-foreground">User Management</h3>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add user
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-status-danger-bg text-status-danger-fg rounded-2xl text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-md border border-input bg-background text-sm"
              />
            </div>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="all">All roles</option>
            <option value="platform_admin">Platform Admin</option>
            <option value="lender_admin">Lender Admin</option>
            <option value="lender_officer">Lender Officer</option>
            <option value="employer_admin">Employer Admin</option>
            <option value="employer_hr">Employer HR</option>
            <option value="borrower">Borrower</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Last login</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-status-info-bg rounded-full flex items-center justify-center">
                          <span className="text-status-info-fg font-medium text-sm">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-foreground">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center text-sm text-foreground">
                          <Mail className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                          {user.email}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                          {user.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${ROLE_TINT_CLASSES[user.role] || ROLE_TINT_CLASSES.borrower}`}>
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {user.company?.name || 'No company'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.department || 'No department'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                        disabled={!canEditUser(user)}
                        className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          user.isActive
                            ? 'bg-status-success-bg text-status-success-fg'
                            : 'bg-[#F0F0EE] text-[#5F5E5A]'
                        } ${canEditUser(user) ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'}`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {canEditUser(user) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                            className="flex items-center"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                        )}
                        {canDeleteUser(user) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(user._id)}
                            className="flex items-center text-status-danger-fg border-status-danger-fg/30 hover:bg-status-danger-bg"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base font-medium text-foreground mb-2">No users found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search criteria.'
                : 'Get started by creating your first user.'
              }
            </p>
          </div>
        )}
      </Card>

      {/* Create User Dialog */}
      {showCreateDialog && (
        <CreateUserDialog
          onClose={() => setShowCreateDialog(false)}
          onUserCreated={(newUser) => {
            setUsers([...users, newUser]);
            setShowCreateDialog(false);
          }}
        />
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUserUpdated={(updatedUser) => {
            setUsers(users.map(user =>
              user._id === updatedUser._id ? updatedUser : user
            ));
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
