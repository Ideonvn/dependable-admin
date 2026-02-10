import apiClient from './api';

export interface Invoice {
  id: string;
  school_id: string;
  invoice_number: string;
  billing_month: number;
  billing_year: number;
  invoice_date: string;
  due_date: string;
  paid_date: string | null;
  subtotal: string;
  vat_amount: string;
  total: string;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  billable_student_count: number;
  notes: string | null;
  plan_type?: 'monthly' | 'annual';
  period_end_date?: string | null;
}

export interface BillingConfig {
  id: string;
  student_unit_price: string;
  vat_rate: string;
  invoice_prefix: string;
  invoice_due_days: number;
  min_admission_days: number;
}

export interface BillingDetails {
  id: string | null;
  company_name: string | null;
  tax_id: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;
  currency: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
}

export interface SchoolPlan {
  id: string;
  plan_type: 'monthly' | 'annual';
  annual_start_date?: string | null;
  annual_end_date?: string | null;
  annual_unit_price?: string | null;
  billing_student_count: number;
  next_invoice_date: string;
}

export interface GenerateInvoiceRequest {
  billing_month: number;
  billing_year: number;
  notes?: string | null;
}

// API for billing
export const billingApi = {
  // Get billing config for a school
  getBillingConfig: async (schoolId: string): Promise<BillingConfig> => {
    try {
      const response = await apiClient.get<BillingConfig>(`/billing/schools/${schoolId}/config`);
      return response.data;
    } catch (error) {
      console.error('Error fetching billing config:', error);
      throw error;
    }
  },

  // Update billing config for a school
  updateBillingConfig: async (schoolId: string, data: Partial<BillingConfig>): Promise<BillingConfig> => {
    try {
      const response = await apiClient.put<BillingConfig>(`/billing/schools/${schoolId}/config`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating billing config:', error);
      throw error;
    }
  },

  // Get invoices for a school
  getInvoices: async (schoolId: string): Promise<Invoice[]> => {
    try {
      const response = await apiClient.get<Invoice[]>(`/billing/schools/${schoolId}/invoices`);
      return response.data;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  },

  // Generate a new invoice
  generateInvoice: async (schoolId: string, data: GenerateInvoiceRequest): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(
      `/billing/schools/${schoolId}/invoices/generate`,
      data
    );
    return response.data;
  },

  // Download invoice PDF
  downloadInvoice: async (schoolId: string, invoiceId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/billing/schools/${schoolId}/invoices/${invoiceId}/download`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },

  // Update invoice status
  updateInvoiceStatus: async (schoolId: string, invoiceId: string, status: Invoice['status']): Promise<Invoice> => {
    try {
      const response = await apiClient.put<Invoice>(
        `/billing/schools/${schoolId}/invoices/${invoiceId}`,
        { status }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating invoice status:', error);
      throw error;
    }
  },

  // Get billing details for a school
  getBillingDetails: async (schoolId: string): Promise<BillingDetails> => {
    try {
      const response = await apiClient.get<BillingDetails>(`/billing/schools/${schoolId}/billing-details`);
      return response.data;
    } catch (error) {
      console.error('Error fetching billing details:', error);
      throw error;
    }
  },

  // Update billing details for a school
  updateBillingDetails: async (schoolId: string, data: Partial<BillingDetails>): Promise<BillingDetails> => {
    try {
      const response = await apiClient.put<BillingDetails>(`/billing/schools/${schoolId}/billing-details`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating billing details:', error);
      throw error;
    }
  },

  // Get school plan
  getSchoolPlan: async (schoolId: string): Promise<SchoolPlan> => {
    try {
      const response = await apiClient.get<SchoolPlan>(`/billing/schools/${schoolId}/plan`);
      return response.data;
    } catch (error) {
      console.error('Error fetching school plan:', error);
      throw error;
    }
  },

  // Update school plan
  updateSchoolPlan: async (schoolId: string, data: Partial<SchoolPlan>): Promise<SchoolPlan> => {
    try {
      const response = await apiClient.put<SchoolPlan>(`/billing/schools/${schoolId}/plan`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating school plan:', error);
      throw error;
    }
  },
};
