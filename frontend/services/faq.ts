const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface FAQResponse {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface FAQPayload {
  question: string;
  answer: string;
}

/**
 * Creates a new FAQ for a business.
 */
export async function createFAQ(businessId: string, payload: FAQPayload, token: string): Promise<FAQResponse> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/faqs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create FAQ.');
  }

  return response.json();
}

/**
 * Lists all FAQs under a business.
 */
export async function listFAQs(businessId: string, token: string): Promise<FAQResponse[]> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/faqs`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve FAQs list.');
  }

  return response.json();
}

/**
 * Retrieves details for a specific FAQ.
 */
export async function getFAQ(id: string, token: string): Promise<FAQResponse> {
  const response = await fetch(`${API_URL}/faqs/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve FAQ details.');
  }

  return response.json();
}

/**
 * Updates details for an FAQ.
 */
export async function updateFAQ(id: string, payload: Partial<FAQPayload>, token: string): Promise<FAQResponse> {
  const response = await fetch(`${API_URL}/faqs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update FAQ.');
  }

  return response.json();
}

/**
 * Deletes an FAQ.
 */
export async function deleteFAQ(id: string, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/faqs/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete FAQ.');
  }
}

export interface FAQImportSummary {
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: string[];
}

/**
 * Bulk imports FAQs from a CSV file.
 */
export async function importFAQsCSV(businessId: string, file: File, reindex: boolean, token: string): Promise<FAQImportSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/businesses/${businessId}/faqs/import-csv?reindex_after_import=${reindex}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to import FAQs.');
  }

  return response.json();
}

