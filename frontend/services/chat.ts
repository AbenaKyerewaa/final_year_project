const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChatRequest {
  message: string;
  customer_name?: string;
  customer_phone?: string;
  channel: string;
  session_id?: string;
}

export interface ChatResponse {
  session_id: string;
  answer: string;
  confidence_score: number;
  sources: Array<{ title: string; source_type: string; score: number }>;
  escalated: boolean;
}

/**
 * Sends a chat message to a specific business AI agent.
 */
export async function sendChatMessage(businessId: string, payload: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/chat/${businessId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to send chat message.');
  }

  return response.json();
}

export interface ChatSessionSummary {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  channel: string;
  created_at: string;
  latest_message?: string;
  escalated: boolean;
  escalation_status?: string;
}

export interface ChatMessageResponse {
  id: string;
  sender: string;
  message: string;
  confidence_score?: number;
  ai_response_source?: string; // Serialized JSON string
  created_at: string;
}

export interface ChatSessionDetail {
  id: string;
  business_id: string;
  customer_name?: string;
  customer_phone?: string;
  channel: string;
  created_at: string;
  escalated: boolean;
  escalation_status?: string;
  messages: ChatMessageResponse[];
}

export interface EscalationResponse {
  id: string;
  business_id: string;
  session_id: string;
  reason?: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  channel: string;
}

/**
 * Lists all chat sessions for a business.
 */
export async function getBusinessChatSessions(businessId: string, token: string): Promise<ChatSessionSummary[]> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/chat-sessions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to load chat history.');
  }

  return response.json();
}

/**
 * Gets details of a single chat session.
 */
export async function getChatSessionDetails(sessionId: string, token: string): Promise<ChatSessionDetail> {
  const response = await fetch(`${API_URL}/chat-sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to retrieve session details.');
  }

  return response.json();
}

/**
 * Lists all escalations for a business.
 */
export async function getBusinessEscalations(businessId: string, token: string): Promise<EscalationResponse[]> {
  const response = await fetch(`${API_URL}/businesses/${businessId}/escalations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to load escalations.');
  }

  return response.json();
}

/**
 * Resolves or ignores an escalation status.
 */
export async function updateEscalationStatus(escalationId: string, status: string, token: string): Promise<EscalationResponse> {
  const response = await fetch(`${API_URL}/escalations/${escalationId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update escalation.');
  }

  return response.json();
}

export interface VoiceChatResponse {
  session_id: string;
  transcription: string;
  answer: string;
  confidence_score: number;
  sources: Array<{ title: string; source_type: string; score: number }>;
  escalated: boolean;
}

/**
 * Sends a voice recording audio blob to the backend transcription and RAG chat flow.
 */
export async function sendVoiceMessage(
  businessId: string,
  audioBlob: Blob,
  payload: {
    session_id?: string;
    customer_name?: string;
    customer_phone?: string;
    channel?: string;
  }
): Promise<VoiceChatResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  
  if (payload.session_id) {
    formData.append('session_id', payload.session_id);
  }
  if (payload.customer_name) {
    formData.append('customer_name', payload.customer_name);
  }
  if (payload.customer_phone) {
    formData.append('customer_phone', payload.customer_phone);
  }
  formData.append('channel', payload.channel || 'voice');

  const response = await fetch(`${API_URL}/chat/${businessId}/voice`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to send voice message.');
  }

  return response.json();
}


