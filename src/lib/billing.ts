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
}

export interface GenerateInvoiceRequest {
  billing_month: number;
  billing_year: number;
  notes?: string | null;
}

// API for billing
export const billingApi = {
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
};
