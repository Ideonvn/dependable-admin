'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { api, ImportBatch } from '@/lib/api';

interface CSVUploadProps {
  onUploadSuccess: (batch: ImportBatch) => void;
}

export default function CSVUpload({ onUploadSuccess }: CSVUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const batch = await api.uploadCSV(file);
      onUploadSuccess(batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload CSV');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <Upload className="w-12 h-12 text-blue-500 animate-pulse" />
              <p className="text-lg text-gray-700">Uploading...</p>
            </>
          ) : (
            <>
              <FileText className="w-12 h-12 text-gray-400" />
              {isDragActive ? (
                <p className="text-lg text-blue-600">Drop the CSV file here</p>
              ) : (
                <>
                  <p className="text-lg text-gray-700">
                    Drag and drop a CSV file here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Upload CSV to create a new import batch
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-800">Upload Failed</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
