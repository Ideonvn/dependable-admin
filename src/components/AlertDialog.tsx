'use client';

import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  title: string;
  message: string;
  variant?: 'success' | 'error' | 'info';
  buttonText?: string;
}

export default function AlertDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'info',
  buttonText = 'OK',
}: AlertDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    success: {
      icon: CheckCircle,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      button: 'bg-green-600 dark:bg-green-700 hover:opacity-90',
    },
    error: {
      icon: AlertCircle,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      button: 'bg-red-600 dark:bg-red-700 hover:opacity-90',
    },
    info: {
      icon: Info,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      button: 'bg-[#1A1A6D] dark:bg-[#20B2AA] hover:opacity-90',
    },
  };

  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 p-2 rounded-full ${style.iconBg}`}>
              <Icon className={`w-5 h-5 ${style.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-[#0F1115] px-6 py-4 flex justify-end rounded-b-lg">
          <button
            onClick={onConfirm || onClose}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${style.button}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
