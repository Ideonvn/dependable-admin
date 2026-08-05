import axios from 'axios';

// Shape of the backend error envelope (see BillingTab / any 422 response).
interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type?: string;
}

export interface ParsedApiError {
  // Human-friendly banner/toast message.
  message: string;
  // Field name -> message, keyed by the last segment of `loc` (e.g. "invoice_prefix").
  fieldErrors: Record<string, string>;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

// Turns any thrown API error into a message + per-field validation errors.
// Field keys are the backend field names (snake_case), which match our payload keys.
export function parseApiError(error: unknown): ParsedApiError {
  const fieldErrors: Record<string, string> = {};

  if (axios.isAxiosError(error)) {
    const backendError = error.response?.data?.error;
    const validationErrors: ValidationError[] = backendError?.validation_errors ?? [];

    for (const ve of validationErrors) {
      const field = String(ve.loc[ve.loc.length - 1]);
      // If a field has multiple issues, join them rather than dropping.
      fieldErrors[field] = fieldErrors[field] ? `${fieldErrors[field]}; ${ve.msg}` : ve.msg;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { message: 'Please correct the highlighted fields.', fieldErrors };
    }

    return { message: backendError?.friendly_message || GENERIC_MESSAGE, fieldErrors };
  }

  return { message: GENERIC_MESSAGE, fieldErrors };
}
