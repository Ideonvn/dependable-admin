'use client';

import { useState, useEffect } from 'react';
import { Receipt, Download, Plus, Calendar, DollarSign, AlertCircle, FileText, Settings, Save, X } from 'lucide-react';
import { billingApi, Invoice, BillingConfig } from '@/lib/billing';

interface BillingTabProps {
  schoolId: string;
}

interface StatusModalState {
  isOpen: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

export default function BillingTab({ schoolId }: BillingTabProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<StatusModalState>({
    isOpen: false,
    invoiceId: null,
    invoiceNumber: null,
  });
  const [toasts, setToasts] = useState<{ id: string; title?: string; message: string; variant?: 'success' | 'error' | 'info' }[]>([]);

  const [formData, setFormData] = useState({
    billing_month: new Date().getMonth() + 1,
    billing_year: new Date().getFullYear(),
    notes: '',
  });

  const [configForm, setConfigForm] = useState<Partial<BillingConfig>>({
    student_unit_price: '',
    vat_rate: '',
    invoice_prefix: '',
    invoice_due_days: 0,
    min_admission_days: 0,
  });

  const addToast = (toast: { title?: string; message: string; variant?: 'success' | 'error' | 'info' }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  };

  useEffect(() => {
    loadInvoices();
    loadBillingConfig();
  }, [schoolId]);

  const loadBillingConfig = async () => {
    setConfigLoading(true);
    try {
      const data = await billingApi.getBillingConfig(schoolId);
      setConfig(data);
      setConfigForm({
        student_unit_price: data.student_unit_price,
        vat_rate: data.vat_rate,
        invoice_prefix: data.invoice_prefix,
        invoice_due_days: data.invoice_due_days,
        min_admission_days: data.min_admission_days,
      });
    } catch (error) {
      console.error('Error loading billing config:', error);
      addToast({ title: 'Error', message: 'Failed to load billing config', variant: 'error' });
    } finally {
      setConfigLoading(false);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await billingApi.getInvoices(schoolId);
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
      addToast({ title: 'Error', message: 'Failed to load invoices', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const newInvoice = await billingApi.generateInvoice(schoolId, {
        billing_month: formData.billing_month,
        billing_year: formData.billing_year,
        notes: formData.notes || null,
      });
      setInvoices([newInvoice, ...invoices]);
      setShowGenerateForm(false);
      setFormData({
        billing_month: new Date().getMonth() + 1,
        billing_year: new Date().getFullYear(),
        notes: '',
      });
      addToast({ title: 'Success', message: 'Invoice generated successfully!', variant: 'success' });
    } catch (error) {
      console.error('Error generating invoice:', error);
      addToast({ title: 'Error', message: 'Failed to generate invoice', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const updated = await billingApi.updateBillingConfig(schoolId, {
        student_unit_price: configForm.student_unit_price,
        vat_rate: configForm.vat_rate,
        invoice_prefix: configForm.invoice_prefix,
        invoice_due_days: configForm.invoice_due_days,
        min_admission_days: configForm.min_admission_days,
      });
      setConfig(updated);
      setShowConfigForm(false);
      addToast({ title: 'Success', message: 'Billing config updated successfully!', variant: 'success' });
    } catch (error) {
      console.error('Error updating config:', error);
      addToast({ title: 'Error', message: 'Failed to update billing config', variant: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    setDownloading(invoiceId);
    try {
      const blob = await billingApi.downloadInvoice(schoolId, invoiceId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast({ title: 'Success', message: 'Invoice downloaded successfully!', variant: 'success' });
    } catch (error) {
      console.error('Error downloading invoice:', error);
      addToast({ title: 'Error', message: 'Failed to download invoice', variant: 'error' });
    } finally {
      setDownloading(null);
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: Invoice['status']) => {
    setUpdatingStatus(invoiceId);
    try {
      const updated = await billingApi.updateInvoiceStatus(schoolId, invoiceId, newStatus);
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updated : inv)));
      setStatusModal({ isOpen: false, invoiceId: null, invoiceNumber: null });
      addToast({ title: 'Success', message: 'Invoice status updated successfully!', variant: 'success' });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      addToast({ title: 'Error', message: 'Failed to update invoice status', variant: 'error' });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'issued':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'overdue':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'cancelled':
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400';
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Billing & Invoices</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">View and manage school invoices</p>
          </div>
        </div>
        {!showGenerateForm && (
          <button
            onClick={() => setShowGenerateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Generate Invoice
          </button>
        )}
      </div>

      {/* Billing Configuration Card */}
      {config && !showConfigForm && (
        <div className="mb-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#1A1A6D] dark:text-[#20B2AA]" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Billing Configuration</h4>
            </div>
            <button
              onClick={() => setShowConfigForm(true)}
              className="text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:underline font-medium"
            >
              Edit
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Student Unit Price</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">R {parseFloat(config.student_unit_price).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">VAT Rate</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{(parseFloat(config.vat_rate) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Invoice Prefix</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{config.invoice_prefix}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Invoice Due Days</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{config.invoice_due_days}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Min Admission Days</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{config.min_admission_days}</div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Configuration Edit Form */}
      {showConfigForm && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Edit Billing Configuration</h4>
            </div>
            <button
              onClick={() => setShowConfigForm(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleUpdateConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student Unit Price (R)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={configForm.student_unit_price}
                  onChange={(e) => setConfigForm({ ...configForm, student_unit_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VAT Rate (0-1)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={configForm.vat_rate}
                  onChange={(e) => setConfigForm({ ...configForm, vat_rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={configForm.invoice_prefix}
                  onChange={(e) => setConfigForm({ ...configForm, invoice_prefix: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Due Days
                </label>
                <input
                  type="number"
                  value={configForm.invoice_due_days}
                  onChange={(e) => setConfigForm({ ...configForm, invoice_due_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Admission Days
                </label>
                <input
                  type="number"
                  value={configForm.min_admission_days}
                  onChange={(e) => setConfigForm({ ...configForm, min_admission_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                  min="1"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={savingConfig}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingConfig ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Configuration
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowConfigForm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Generate Invoice Form */}
      {showGenerateForm && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Generate New Invoice</h4>
            </div>
            <button
              onClick={() => setShowGenerateForm(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleGenerateInvoice} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Billing Month
                </label>
                <select
                  value={formData.billing_month}
                  onChange={(e) => setFormData({ ...formData, billing_month: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                >
                  {months.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Billing Year
                </label>
                <input
                  type="number"
                  value={formData.billing_year}
                  onChange={(e) => setFormData({ ...formData, billing_year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                  min="2020"
                  max="2100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                rows={3}
                placeholder="Add any notes about this invoice..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowGenerateForm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Receipt className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No invoices yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Generate your first invoice to get started
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Invoice #</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Period</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Issue Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Due Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Students</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{invoice.invoice_number}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                    {months[invoice.billing_month - 1]} {invoice.billing_year}
                  </td>
                  <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{invoice.billable_student_count}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="text-gray-900 dark:text-gray-100">
                      <div className="font-semibold">R {invoice.total}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Subtotal: R {invoice.subtotal} + VAT: R {invoice.vat_amount}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                      <button
                        onClick={() => setStatusModal({ isOpen: true, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number })}
                        disabled={updatingStatus === invoice.id}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)} hover:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer`}
                      >
                        {updatingStatus === invoice.id ? (
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          </span>
                        ) : (
                          invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleDownload(invoice.id, invoice.invoice_number)}
                        disabled={downloading === invoice.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:bg-[#1A1A6D]/10 dark:hover:bg-[#20B2AA]/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {downloading === invoice.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Download
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Update Invoice Status
              </h3>
              <button
                onClick={() => setStatusModal({ isOpen: false, invoiceId: null, invoiceNumber: null })}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Invoice: <span className="font-medium text-gray-900 dark:text-gray-100">{statusModal.invoiceNumber}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a new status:
              </p>
              <div className="space-y-2">
                {['draft', 'issued', 'paid', 'overdue', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      if (statusModal.invoiceId) {
                        handleUpdateInvoiceStatus(statusModal.invoiceId, status as Invoice['status']);
                      }
                    }}
                    disabled={updatingStatus === statusModal.invoiceId}
                    className={`w-full px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                      status === 'draft'
                        ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        : status === 'issued'
                        ? 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        : status === 'paid'
                        ? 'border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : status === 'overdue'
                        ? 'border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    } disabled:opacity-50 flex items-center justify-center gap-2`}
                  >
                    {updatingStatus === statusModal.invoiceId ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Updating...
                      </>
                    ) : (
                      status.charAt(0).toUpperCase() + status.slice(1)
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg border transition-opacity bg-white dark:bg-[#111217] border-gray-200 dark:border-gray-800 ${
              t.variant === 'success' ? 'ring-2 ring-green-500 dark:ring-green-400' : 
              t.variant === 'error' ? 'ring-2 ring-red-500 dark:ring-red-400' : 
              'ring-1 ring-gray-200 dark:ring-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {t.title && <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>}
                <div className="text-sm text-gray-700 dark:text-gray-300">{t.message}</div>
              </div>
              <button onClick={() => setToasts((s) => s.filter(x => x.id !== t.id))} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
