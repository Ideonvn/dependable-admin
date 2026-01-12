'use client';

import React from 'react';
import { ImportBatch } from '@/lib/api';
import { FileText, CheckCircle, XCircle, Clock, Loader } from 'lucide-react';

interface BatchListProps {
  batches: ImportBatch[];
  onSelectBatch: (batch: ImportBatch) => void;
  selectedBatchId?: string;
}

export default function BatchList({ batches, onSelectBatch, selectedBatchId }: BatchListProps) {
  const getStatusIcon = (status: ImportBatch['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'processing':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'validated':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ImportBatch['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'validated':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>No import batches yet. Upload a CSV to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <div
          key={batch.id}
          onClick={() => onSelectBatch(batch)}
          className={`
            p-4 border rounded-lg cursor-pointer transition-all duration-200
            ${selectedBatchId === batch.id 
              ? 'border-blue-500 bg-blue-50 shadow-md' 
              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }
          `}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              {getStatusIcon(batch.status)}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {batch.filename}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(batch.created_at).toLocaleString()}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-gray-600">
                    Total: <span className="font-medium">{batch.total_rows}</span>
                  </span>
                  {batch.valid_rows > 0 && (
                    <span className="text-green-600">
                      Valid: <span className="font-medium">{batch.valid_rows}</span>
                    </span>
                  )}
                  {batch.invalid_rows > 0 && (
                    <span className="text-red-600">
                      Invalid: <span className="font-medium">{batch.invalid_rows}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
              {batch.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
