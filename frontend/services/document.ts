const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface DocumentResponse {
  id: string;
  business_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  processed_status: string; // pending, processed, failed
  extracted_text?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Uploads a document file for a business.
 */
export async function uploadDocument(businessId: string, file: File, token: string): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/businesses/${businessId}/documents/upload`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
      // Note: Do NOT set 'Content-Type' manually when uploading FormData. The browser will set it with the correct boundary boundary boundary.
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload document.');
  }

  return response.json();
}

/**
 * Lists all documents under a business.
 */
export async function listDocuments(businessId: string, token: string): Promise<DocumentResponse[]> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/documents`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve documents list.');
  }

  return response.json();
}

/**
 * Retrieves details/status for a specific document.
 */
export async function getDocument(id: string, token: string): Promise<DocumentResponse> {
  const response = await fetch(`${API_URL}/documents/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve document details.');
  }

  return response.json();
}

/**
 * Deletes a document.
 */
export async function deleteDocument(id: string, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/documents/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete document.');
  }
}
