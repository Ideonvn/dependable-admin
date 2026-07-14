'use client';

import { useState, useEffect } from 'react';
import { Receipt, Download, Plus, Calendar, DollarSign, AlertCircle, FileText, Settings, Save, X, MapPin, Mail, Phone, ChevronDown } from 'lucide-react';
import posthog from 'posthog-js';
import { billingApi, Invoice, BillingConfig, BillingDetails, SchoolPlan } from '@/lib/billing';
import { userSetupService } from '@/lib/userSetupService';

interface BillingTabProps {
  schoolId: string;
}

interface StatusModalState {
  isOpen: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

type BillingTabType = 'invoices' | 'configuration' | 'details' | 'plan';

export default function BillingTab({ schoolId }: BillingTabProps) {
  const isSuperAdmin = userSetupService.isAdmin();
  const [activeTab, setActiveTab] = useState<BillingTabType>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const [schoolPlan, setSchoolPlan] = useState<SchoolPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
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

  const [detailsForm, setDetailsForm] = useState<Partial<BillingDetails>>({
    billing_contact_name: '',
    billing_contact_email: '',
    billing_contact_phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    postal_code: '',
    country: '',
    tax_id: '',
    company_name: '',
    currency: 'ZAR',
  });

  const [planForm, setPlanForm] = useState<Partial<SchoolPlan>>({
    plan_type: 'monthly',
    billing_student_count: 0,
    next_invoice_date: '',
    annual_start_date: '',
    annual_end_date: '',
    annual_unit_price: '',
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
    loadBillingDetails();
    if (isSuperAdmin) {
      loadBillingConfig();
      loadSchoolPlan();
    }
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

  const loadBillingDetails = async () => {
    setDetailsLoading(true);
    try {
      const data = await billingApi.getBillingDetails(schoolId);
      setBillingDetails(data);
      setDetailsForm({
        billing_contact_name: data.billing_contact_name || '',
        billing_contact_email: data.billing_contact_email || '',
        billing_contact_phone: data.billing_contact_phone || '',
        address_line_1: data.address_line_1 || '',
        address_line_2: data.address_line_2 || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        country: data.country || '',
        tax_id: data.tax_id || '',
        company_name: data.company_name || '',
        currency: data.currency || 'ZAR',
      });
    } catch (error) {
      console.error('Error loading billing details:', error);
      addToast({ title: 'Error', message: 'Failed to load billing details', variant: 'error' });
    } finally {
      setDetailsLoading(false);
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

  const loadSchoolPlan = async () => {
    setPlanLoading(true);
    try {
      const data = await billingApi.getSchoolPlan(schoolId);
      setSchoolPlan(data);
      setPlanForm({
        plan_type: data.plan_type,
        billing_student_count: data.billing_student_count,
        next_invoice_date: data.next_invoice_date,
        annual_start_date: data.annual_start_date || '',
        annual_end_date: data.annual_end_date || '',
        annual_unit_price: data.annual_unit_price || '',
      });
    } catch (error) {
      console.error('Error loading school plan:', error);
      addToast({ title: 'Error', message: 'Failed to load school plan', variant: 'error' });
    } finally {
      setPlanLoading(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const updated = await billingApi.updateSchoolPlan(schoolId, {
        plan_type: planForm.plan_type as 'monthly' | 'annual',
        billing_student_count: planForm.billing_student_count,
        next_invoice_date: planForm.next_invoice_date,
        annual_start_date: planForm.plan_type === 'annual' ? planForm.annual_start_date : undefined,
        annual_end_date: planForm.plan_type === 'annual' ? planForm.annual_end_date : undefined,
        annual_unit_price: planForm.plan_type === 'annual' ? planForm.annual_unit_price : undefined,
      });
      setSchoolPlan(updated);
      setShowPlanForm(false);
      posthog.capture('billing_plan_updated', { school_id: schoolId, plan_type: planForm.plan_type });
      addToast({ title: 'Success', message: 'Billing plan updated successfully!', variant: 'success' });
    } catch (error) {
      console.error('Error updating plan:', error);
      addToast({ title: 'Error', message: 'Failed to update billing plan', variant: 'error' });
    } finally {
      setSavingPlan(false);
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
      posthog.capture('invoice_generated', {
        school_id: schoolId,
        billing_month: formData.billing_month,
        billing_year: formData.billing_year,
      });
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

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDetails(true);
    try {
      const updated = await billingApi.updateBillingDetails(schoolId, {
        billing_contact_name: detailsForm.billing_contact_name,
        billing_contact_email: detailsForm.billing_contact_email,
        billing_contact_phone: detailsForm.billing_contact_phone,
        address_line_1: detailsForm.address_line_1,
        address_line_2: detailsForm.address_line_2 || null,
        city: detailsForm.city,
        postal_code: detailsForm.postal_code,
        country: detailsForm.country,
        tax_id: detailsForm.tax_id || null,
        company_name: detailsForm.company_name,
        currency: detailsForm.currency,
      });
      setBillingDetails(updated);
      setShowDetailsForm(false);
      addToast({ title: 'Success', message: 'Billing details updated successfully!', variant: 'success' });
    } catch (error) {
      console.error('Error updating details:', error);
      addToast({ title: 'Error', message: 'Failed to update billing details', variant: 'error' });
    } finally {
      setSavingDetails(false);
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
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Receipt className="w-6 h-6 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Billing & Invoices</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">View and manage school billing</p>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
          {(
            [
              { id: 'invoices', label: 'Invoices', icon: Receipt, adminOnly: false },
              { id: 'configuration', label: 'Configuration', icon: Settings, adminOnly: true },
              { id: 'details', label: 'Billing Details', icon: MapPin, adminOnly: false },
              { id: 'plan', label: 'Billing Plan', icon: Calendar, adminOnly: true },
            ] as const
          ).filter(({ adminOnly }) => !adminOnly || isSuperAdmin).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-[#1A1A6D] dark:border-[#20B2AA] text-[#1A1A6D] dark:text-[#20B2AA]'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - Invoices */}
      {activeTab === 'invoices' && (
        <>
          {isSuperAdmin && (
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowGenerateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Generate Invoice
              </button>
            </div>
          )}

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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Plan Type</th>
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
                      <td className="py-4 px-4">
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {invoice.plan_type || 'monthly'}
                        </span>
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
                          {isSuperAdmin ? (
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
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </span>
                          )}
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
        </>
      )}

      {/* Tab Content - Details */}
      {activeTab === 'details' && (
        <div>
          {billingDetails && (
            <div className="mb-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0 mr-8">Billing Details</h4>
                  <div className="flex flex-wrap gap-6 flex-1 items-start">
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Company Name</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{billingDetails.company_name || 'Not set'}</div>
                    </div>
                    {billingDetails.tax_id && (
                      <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Tax ID</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{billingDetails.tax_id}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Contact Name</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{billingDetails.billing_contact_name || 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Email</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{billingDetails.billing_contact_email || 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Phone</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{billingDetails.billing_contact_phone || 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Address</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {billingDetails.address_line_1 || 'Not set'}
                        {(billingDetails.city || billingDetails.postal_code) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {[billingDetails.city, billingDetails.postal_code].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsForm(true)}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex-shrink-0 ml-4"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Configuration */}
      {activeTab === 'configuration' && (
        <div>
          {config && (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <Settings className="w-5 h-5 text-[#1A1A6D] dark:text-[#20B2AA] flex-shrink-0" />
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mr-8">Billing Configuration</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 flex-1">
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Student Unit Price</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">R {parseFloat(config.student_unit_price).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">VAT Rate</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(parseFloat(config.vat_rate) * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Invoice Prefix</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{config.invoice_prefix}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Invoice Due Days</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{config.invoice_due_days}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Min Admission Days</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{config.min_admission_days}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigForm(true)}
                  className="text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:underline font-medium flex-shrink-0 ml-4"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Plan */}
      {activeTab === 'plan' && (
        <div>
          {schoolPlan && !planLoading && (
            <div className="mb-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0 mr-8">Billing Plan</h4>
              <div className="flex flex-wrap gap-6 flex-1 items-start">
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Plan Type</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{schoolPlan.plan_type}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Billing Student Count</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{schoolPlan.billing_student_count}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Next Invoice Date</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(schoolPlan.next_invoice_date).toLocaleDateString()}
                  </div>
                </div>
                {schoolPlan.plan_type === 'annual' && (
                  <>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Annual Start Date</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {schoolPlan.annual_start_date ? new Date(schoolPlan.annual_start_date).toLocaleDateString() : 'Not set'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Annual End Date</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {schoolPlan.annual_end_date ? new Date(schoolPlan.annual_end_date).toLocaleDateString() : 'Not set'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Annual Unit Price</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">R {schoolPlan.annual_unit_price || '0.00'}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowPlanForm(true)}
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium flex-shrink-0 ml-4"
            >
              Edit
            </button>
          </div>
        </div>
          )}
        </div>
      )}

      {/* All Modals */}
      {/* Edit Billing Plan Modal */}
      {showPlanForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Edit Billing Plan</h4>
              </div>
              <button
                onClick={() => setShowPlanForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdatePlan} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plan Type
                  </label>
                  <select
                    value={planForm.plan_type || 'monthly'}
                    onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value as 'monthly' | 'annual' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Billing Student Count
                  </label>
                  <input
                    type="number"
                    value={planForm.billing_student_count || 0}
                    onChange={(e) => setPlanForm({ ...planForm, billing_student_count: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                    min="0"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Next Invoice Date
                  </label>
                  <input
                    type="date"
                    value={planForm.next_invoice_date || ''}
                    onChange={(e) => setPlanForm({ ...planForm, next_invoice_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                {planForm.plan_type === 'annual' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Annual Start Date
                      </label>
                      <input
                        type="date"
                        value={planForm.annual_start_date || ''}
                        onChange={(e) => setPlanForm({ ...planForm, annual_start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Annual End Date
                      </label>
                      <input
                        type="date"
                        value={planForm.annual_end_date || ''}
                        onChange={(e) => setPlanForm({ ...planForm, annual_end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Annual Unit Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={planForm.annual_unit_price || ''}
                        onChange={(e) => setPlanForm({ ...planForm, annual_unit_price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingPlan ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Plan
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlanForm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Billing Details Edit Modal */}
      {showDetailsForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Billing Details</h3>
              </div>
              <button
                onClick={() => setShowDetailsForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={detailsForm.company_name || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tax ID / VAT Number
                    </label>
                    <input
                      type="text"
                      value={detailsForm.tax_id || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, tax_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Billing Contact Name
                    </label>
                    <input
                      type="text"
                      value={detailsForm.billing_contact_name || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, billing_contact_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Billing Contact Email
                    </label>
                    <input
                      type="email"
                      value={detailsForm.billing_contact_email || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, billing_contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Billing Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={detailsForm.billing_contact_phone || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, billing_contact_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Currency
                    </label>
                    <select
                      value={detailsForm.currency || 'ZAR'}
                      onChange={(e) => setDetailsForm({ ...detailsForm, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="ZAR">ZAR</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={detailsForm.address_line_1 || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, address_line_1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={detailsForm.address_line_2 || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, address_line_2: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={detailsForm.city || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={detailsForm.postal_code || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, postal_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={detailsForm.country || ''}
                      onChange={(e) => setDetailsForm({ ...detailsForm, country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={savingDetails}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {savingDetails ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Details
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailsForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoice Form */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Generate New Invoice</h4>
              </div>
              <button
                onClick={() => setShowGenerateForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGenerateInvoice} className="p-6 space-y-4">
              {schoolPlan?.plan_type === 'monthly' && (
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
              )}
              {schoolPlan?.plan_type === 'annual' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Annual plan detected. Invoice will be generated for the annual billing period.
                  </p>
                </div>
              )}
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
        </div>
      )}

      {/* Edit Billing Configuration Modal */}
      {showConfigForm && config && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#1A1A6D] dark:text-[#20B2AA]" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Edit Billing Configuration</h4>
              </div>
              <button
                onClick={() => setShowConfigForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateConfig} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student Unit Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={configForm.student_unit_price || ''}
                  onChange={(e) => setConfigForm({ ...configForm, student_unit_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VAT Rate (as decimal, e.g., 0.15 for 15%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={configForm.vat_rate || ''}
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
                  value={configForm.invoice_prefix || ''}
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
                  value={configForm.invoice_due_days || ''}
                  onChange={(e) => setConfigForm({ ...configForm, invoice_due_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Admission Days
                </label>
                <input
                  type="number"
                  value={configForm.min_admission_days || ''}
                  onChange={(e) => setConfigForm({ ...configForm, min_admission_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                  min="0"
                />
              </div>
              <div className="flex gap-2">
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
                      Save Changes
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
