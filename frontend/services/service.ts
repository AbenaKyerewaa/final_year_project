const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface ServiceResponse {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  duration?: string;
  duration_unit?: string;
  availability_status: string; // available, unavailable
  created_at: string;
  updated_at: string;
}

export interface ServicePayload {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  duration?: string;
  duration_unit?: string;
  availability_status?: string;
}

/**
 * Creates a new service under a business.
 */
export async function createService(businessId: string, payload: ServicePayload, token: string): Promise<ServiceResponse> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/services`, {
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
    throw new Error(errorData.detail || 'Failed to create service.');
  }

  return response.json();
}

/**
 * Lists all services of a business profile.
 */
export async function listServices(businessId: string, token: string): Promise<ServiceResponse[]> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/services`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve services list.');
  }

  return response.json();
}

/**
 * Retrieves details for a specific service.
 */
export async function getService(id: string, token: string): Promise<ServiceResponse> {
  const response = await fetch(`${API_URL}/services/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve service details.');
  }

  return response.json();
}

/**
 * Updates details for a service profile.
 */
export async function updateService(id: string, payload: Partial<ServicePayload>, token: string): Promise<ServiceResponse> {
  const response = await fetch(`${API_URL}/services/${id}`, {
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
    throw new Error(errorData.detail || 'Failed to update service details.');
  }

  return response.json();
}

/**
 * Deletes a service profile.
 */
export async function deleteService(id: string, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/services/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete service.');
  }
}

export interface ServiceImportSummary {
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: string[];
}

/**
 * Bulk imports services from a CSV file.
 */
export async function importServicesCSV(businessId: string, file: File, reindex: boolean, token: string): Promise<ServiceImportSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/businesses/${businessId}/services/import-csv?reindex_after_import=${reindex}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to import services.');
  }

  return response.json();
}
