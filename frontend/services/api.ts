const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface HealthResponse {
  status: string;
  database: string;
  ai_provider: string;
  timestamp: string;
  error?: string;
}

/**
 * Checks the health status of the backend API.
 */
export async function getHealthStatus(): Promise<HealthResponse> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Keep cache off to ensure active checks
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data as HealthResponse;
  } catch (error: any) {
    console.error('Error fetching backend health:', error);
    return {
      status: 'disconnected',
      database: 'offline',
      ai_provider: 'offline',
      timestamp: new Date().toISOString(),
      error: error.message || 'Failed to connect to backend',
    };
  }
}
