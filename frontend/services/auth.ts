const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  role: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Sends a registration request to the backend.
 */
export async function registerUser(payload: RegisterPayload): Promise<UserResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Registration failed. Please check details and try again.');
  }

  return response.json();
}

/**
 * Sends a login request and returns the TokenResponse.
 */
export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Incorrect email or password.');
  }

  return response.json();
}

/**
 * Retrieves the current logged in user details using the bearer token.
 */
export async function getMe(token: string): Promise<UserResponse> {
  const response = await fetch(`${API_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Session expired. Please log in again.');
  }

  return response.json();
}

/**
 * Performs a logout. Hits the backend placeholder endpoint and resolves.
 */
export async function logoutUser(token?: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers,
    });
  } catch (error) {
    console.error('Error logging out from backend (non-blocking):', error);
  }
}
