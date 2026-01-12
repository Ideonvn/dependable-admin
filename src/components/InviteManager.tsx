'use client';

import React, { useState } from 'react';
import { Invite } from '@/lib/api';
import { Mail, RotateCw, XCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface InviteManagerProps {
  invites: Invite[];
  onSendInvites: (inviteIds?: string[]) => Promise<void>;
  onResendInvites: (inviteIds: string[]) => Promise<void>;
  onCancelInvites: (inviteIds: string[]) => Promise<void>;
}

export default function InviteManager({
  invites,
  onSendInvites,
  onResendInvites,
  onCancelInvites,
}: InviteManagerProps) {
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const handleSelectAll = () => {
    if (selectedInvites.size === invites.length) {
      setSelectedInvites(new Set());
    } else {
      setSelectedInvites(new Set(invites.map(inv => inv.id)));
    }
  };

  const handleSelectInvite = (inviteId: string) => {
    const newSelected = new Set(selectedInvites);
    if (newSelected.has(inviteId)) {
      newSelected.delete(inviteId);
    } else {
      newSelected.add(inviteId);
    }
    setSelectedInvites(newSelected);
  };

  const handleAction = async (
    action: 'send' | 'resend' | 'cancel',
    inviteIds?: string[]
  ) => {
    setProcessing(true);
    try {
      const ids = inviteIds || Array.from(selectedInvites);
      
      switch (action) {
        case 'send':
          await onSendInvites(ids.length === invites.length ? undefined : ids);
          break;
        case 'resend':
          await onResendInvites(ids);
          break;
        case 'cancel':
          await onCancelInvites(ids);
          break;
      }
      
      setSelectedInvites(new Set());
    } catch (error) {
      console.error(`${action} error:`, error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status: Invite['status']) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: Invite['status']) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const pendingInvites = invites.filter(inv => inv.status === 'pending');
  const failedInvites = invites.filter(inv => inv.status === 'failed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Invites ({invites.length})
          </h3>
          <p className="text-sm text-gray-600">
            Manage and send invitations
          </p>
        </div>
        <div className="flex gap-2">
          {pendingInvites.length > 0 && (
            <button
              onClick={() => handleAction('send')}
              disabled={processing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Send All Pending
            </button>
          )}
          {failedInvites.length > 0 && (
            <button
              onClick={() => handleAction('resend', failedInvites.map(inv => inv.id))}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCw className="w-4 h-4" />
              Resend Failed
            </button>
          )}
          {selectedInvites.size > 0 && (
            <>
              <button
                onClick={() => handleAction('resend')}
                disabled={processing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCw className="w-4 h-4" />
                Resend ({selectedInvites.size})
              </button>
              <button
                onClick={() => handleAction('cancel')}
                disabled={processing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Cancel ({selectedInvites.size})
              </button>
            </>
          )}
        </div>
      </div>

      {invites.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-gray-200 rounded-lg">
          <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No invites yet. Validate the batch to create invites.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedInvites.size === invites.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {invites.map((invite) => (
                <tr key={invite.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedInvites.has(invite.id)}
                      onChange={() => handleSelectInvite(invite.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{invite.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{invite.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(invite.status)}`}>
                      {getStatusIcon(invite.status)}
                      {invite.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invite.sent_at ? new Date(invite.sent_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
