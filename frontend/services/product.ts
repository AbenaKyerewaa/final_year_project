const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface ProductResponse {
  id: string;
  business_id: string;
  name: string;
  category?: string;
  description?: string;
  price: number;
  currency: string;
  quantity: number;
  availability_status: string; // available, out_of_stock, limited
  warranty?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductPayload {
  name: string;
  category?: string;
  description?: string;
  price: number;
  currency?: string;
  quantity?: number;
  availability_status?: string;
  warranty?: string;
  image_url?: string;
}

/**
 * Creates a new product for a business.
 */
export async function createProduct(businessId: string, payload: ProductPayload, token: string): Promise<ProductResponse> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/products`, {
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
    throw new Error(errorData.detail || 'Failed to create product.');
  }

  return response.json();
}

/**
 * Lists all products scoped under a business.
 */
export async function listProducts(businessId: string, token: string): Promise<ProductResponse[]> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/products`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve products list.');
  }

  return response.json();
}

/**
 * Retrieves details for a specific product.
 */
export async function getProduct(id: string, token: string): Promise<ProductResponse> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve product details.');
  }

  return response.json();
}

/**
 * Updates details or stock status for a product.
 */
export async function updateProduct(id: string, payload: Partial<ProductPayload>, token: string): Promise<ProductResponse> {
  const response = await fetch(`${API_URL}/products/${id}`, {
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
    throw new Error(errorData.detail || 'Failed to update product details.');
  }

  return response.json();
}

/**
 * Deletes a product item.
 */
export async function deleteProduct(id: string, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete product.');
  }
}

export interface ImportSummary {
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: string[];
}

/**
 * Bulk imports products from a CSV file.
 */
export async function importProductsCSV(businessId: string, file: File, reindex: boolean, token: string): Promise<ImportSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/businesses/${businessId}/products/import-csv?reindex_after_import=${reindex}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to import products.');
  }

  return response.json();
}

