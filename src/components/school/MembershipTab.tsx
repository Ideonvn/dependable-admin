'use client';

import { useState, useEffect } from 'react';
import { UserCog, Search, Plus, User, Shield, GraduationCap } from 'lucide-react';
import { schoolsApi, Membership } from '@/lib/schools';

interface MembershipTabProps {
  schoolId: string;
}

export default function MembershipTab({ schoolId }: MembershipTabProps) {
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMembership();
  }, [schoolId]);

  const loadMembership = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getMemberships(schoolId);
      setMemberships(data);
    } catch (error) {
      console.error('Error loading membership:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter memberships based on search query
  const filteredMemberships = memberships.filter((membership) =>
    membership.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleIcon = (role: Membership['role']) => {
    switch (role) {
      case 'ADMIN':
        return Shield;
      case 'TEACHER':
        return GraduationCap;
      default:
        return User;
    }
  };

  const getRoleColor = (role: Membership['role']) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'TEACHER':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: Membership['status']) => {
    return status === 'active'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Membership</h3>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search teachers and admins..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredMemberships.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <UserCog className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{searchQuery ? 'No members found matching your search' : 'No members yet'}</p>
          <p className="text-sm mt-2">{searchQuery ? 'Try a different search term' : 'Add members to get started'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Member</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Started</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Ended</th>
              </tr>
            </thead>
            <tbody>
              {filteredMemberships.map((membership) => {
                const RoleIcon = getRoleIcon(membership.role);
                return (
                  <tr
                    key={membership.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white font-semibold">
                          {membership.image_filename ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}/files/${membership.image_filename}`}
                              alt={membership.full_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {membership.full_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            ID: {membership.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(membership.role)}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        {membership.role.charAt(0) + membership.role.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(membership.status)}`}>
                        {membership.status.charAt(0).toUpperCase() + membership.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(membership.started_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {membership.ended_at ? new Date(membership.ended_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
