'use client';

import React, { useState } from 'react';
import { ImportBatch, ValidationResult, ValidationIssue } from '@/lib/api';
import { CheckCircle, AlertTriangle, AlertCircle, Loader } from 'lucide-react';

interface BatchValidatorProps {
  batch: ImportBatch;
  onValidate: (batchId: string) => Promise<ValidationResult>;
  onValidationComplete: (result: ValidationResult) => void;
}

export default function BatchValidator({ 
  batch, 
  onValidate, 
  onValidationComplete 
}: BatchValidatorProps) {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const validationResult = await onValidate(batch.id);
      setResult(validationResult);
      onValidationComplete(validationResult);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setValidating(false);
    }
  };

  const groupIssuesByRow = (issues: ValidationIssue[]) => {
    return issues.reduce((acc, issue) => {
      if (!acc[issue.row]) {
        acc[issue.row] = [];
      }
      acc[issue.row].push(issue);
      return acc;
    }, {} as Record<number, ValidationIssue[]>);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Validation</h3>
          <p className="text-sm text-gray-600">
            Validate the CSV data and create invites
          </p>
        </div>
        <button
          onClick={handleValidate}
          disabled={validating || batch.status === 'validated'}
          className={`
            px-6 py-2 rounded-lg font-medium transition-colors duration-200
            ${validating || batch.status === 'validated'
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          `}
        >
          {validating ? (
            <span className="flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              Validating...
            </span>
          ) : batch.status === 'validated' ? (
            'Validated'
          ) : (
            'Validate Batch'
          )}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${result.valid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-start gap-3">
              {result.valid ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              )}
              <div>
                <h4 className={`font-semibold ${result.valid ? 'text-green-800' : 'text-yellow-800'}`}>
                  {result.valid ? 'Validation Successful' : 'Validation Completed with Issues'}
                </h4>
                <p className={`text-sm mt-1 ${result.valid ? 'text-green-700' : 'text-yellow-700'}`}>
                  {result.total_invites} invite{result.total_invites !== 1 ? 's' : ''} created
                  {result.issues.length > 0 && ` with ${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>

          {result.issues.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Validation Issues ({result.issues.length})
                </h4>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Row</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Field</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Issue</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {result.issues.map((issue, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{issue.row}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">{issue.field}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{issue.message}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            issue.severity === 'error' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {issue.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
