const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface BusinessResponse {
  id: string;
  owner_id: string;
  business_name: string;
  category: string;
  location: string;
  phone: string;
  whatsapp_number?: string;
  opening_hours?: string;
  payment_methods?: string;
  delivery_options?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessPayload {
  business_name: string;
  category: string;
  location: string;
  phone: string;
  whatsapp_number?: string;
  opening_hours?: string;
  payment_methods?: string;
  delivery_options?: string;
  description?: string;
}

/**
 * Creates a new business profile.
 */
export async function createBusiness(payload: BusinessPayload, token: string): Promise<BusinessResponse> {
  const response = await fetch(`${API_URL}/businesses`, {
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
    throw new Error(errorData.detail || 'Failed to create business profile.');
  }

  return response.json();
}

/**
 * Lists all businesses owned by the current user.
 */
export async function listBusinesses(token: string): Promise<BusinessResponse[]> {
  const response = await fetch(`${API_URL}/businesses`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to load business profiles.');
  }

  return response.json();
}

/**
 * Gets a single business profile detail.
 */
export async function getBusiness(id: string, token: string): Promise<BusinessResponse> {
  const response = await fetch(`${API_URL}/businesses/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve business profile.');
  }

  return response.json();
}

/**
 * Updates a business profile.
 */
export async function updateBusiness(id: string, payload: Partial<BusinessPayload>, token: string): Promise<BusinessResponse> {
  const response = await fetch(`${API_URL}/businesses/${id}`, {
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
    throw new Error(errorData.detail || 'Failed to update business profile.');
  }

  return response.json();
}

/**
 * Deletes a business profile.
 */
export async function deleteBusiness(id: string, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/businesses/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete business profile.');
  }
}

export interface BusinessPublicResponse {
  business_name: string;
  category: string;
  location: string;
  opening_hours?: string;
  description?: string;
}

/**
 * Gets a single business profile detail publicly. No token needed.
 */
export async function getPublicBusiness(id: string): Promise<BusinessPublicResponse> {
  const response = await fetch(`${API_URL}/public/businesses/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve business profile.');
  }

  return response.json();
}

/**
 * Triggers RAG index rebuilding for a business.
 */
export async function rebuildRAGIndex(businessId: string, token: string): Promise<any> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/rag/reindex`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to rebuild search index.');
  }

  return response.json();
}

