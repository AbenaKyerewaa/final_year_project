# Phase 13 Documentation: Voice Input Support

This document tracks the objectives, backend components, frontend updates, configuration parameters, and verification procedures for **Phase 13: Voice Input Support** of EasyBiz AI.

---

## Objectives Completed

1.  **Speech-to-Text Abstraction Layer:**
    *   Created `BaseSpeechToTextProvider` class detailing the common interface for speech transcribers.
    *   Created `MockSpeechToTextProvider` enabling offline, deterministic pattern-matching transcription for testing without heavy library downloads.
    *   Created `LocalWhisperProvider` utilizing `faster-whisper` or `openai-whisper` dynamically on CPU if installed.
    *   Created `APISpeechToTextProvider` transcribing audio uploads via direct requests to OpenAI's Whisper API.
    *   Created a provider factory `get_stt_provider()` that resolves the active provider from environment configurations.

2.  **Voice Chat Backend Endpoint:**
    *   Exposed endpoint: `POST /chat/{business_id}/voice`.
    *   Accepts multipart form-data: `file` (audio upload), `session_id`, `customer_name`, `customer_phone`, and `channel`.
    *   Writes file stream to a temporary directory using original filename prefixes, transcribes audio, routes text into the standard RAG/chat pipeline, cleans up temporary files, and returns a unified `VoiceChatResponse` response containing both transcription and AI response.

3.  **Frontend Services Layer:**
    *   Updated `frontend/services/chat.ts` to include `VoiceChatResponse` and the `sendVoiceMessage` client fetch method.

4.  **Customer Chat Recording UI:**
    *   Integrated HTML5 Web Audio `MediaRecorder` API into the customer chat interface (`/chat/[businessId]`).
    *   Added Microphone Permission error banner handling with custom alerts for denied permission.
    *   Designed a gorgeous, premium recording control bar featuring a pulsing recording animation, elapsed time counter, a "Cancel" button, and a "Stop & Send" button.
    *   Implemented speech message dispatch: uploads recorded bytes and updates placeholder bubbles with the transcribed speech string.

---

## Technical Specifications

### `POST /chat/{business_id}/voice`

#### Request Payload (Multipart FormData)
- `file`: Binary audio file (`UploadFile`).
- `session_id`: Optional UUID (`Form`).
- `customer_name`: Optional String (`Form`).
- `customer_phone`: Optional String (`Form`).
- `channel`: String, defaults to `"voice"` (`Form`).

#### Response Payload (`VoiceChatResponse`)
```json
{
  "session_id": "cc1f771e-3ee7-4a8f-b34f-097d891d2a74",
  "transcription": "What are your opening hours?",
  "answer": "We are open Monday to Friday from 8:00 AM to 5:00 PM.",
  "confidence_score": 0.95,
  "sources": [
    {
      "title": "Business Profile Information",
      "source_type": "profile",
      "score": 0.95
    }
  ],
  "escalated": false
}
```

---

## Configuration Variables

Configure voice support via `backend/.env`:
```env
# Speech-To-Text Configuration
# Modes: mock, local, api
STT_PROVIDER=mock
MOCK_STT_TRANSCRIPTION=
```

---

## File Scaffold for Phase 13

```text
EasyBiz-ai/
  backend/
    app/
      speech_providers/
        __init__.py         # Exposes get_stt_provider and BaseSpeechToTextProvider
        base.py             # Abstract Speech-to-Text provider interface
        mock.py             # Mock transcription provider (deterministic pattern-matching)
        local.py            # Local faster-whisper/openai-whisper provider
        api.py              # Requests-based OpenAI Whisper client provider
        factory.py          # Environment resolver factory method
      chat/
        routes.py           # Registered POST /chat/{business_id}/voice and VoiceChatResponse
  frontend/
    services/
      chat.ts               # Added sendVoiceMessage and VoiceChatResponse type
    app/
      chat/
        [businessId]/
          page.tsx          # Added mic recording triggers, permissions, timers, and styling
```

---

## Verification Guide

To test the voice integration:

### Backend Integration Test execution:
1. Make sure the uvicorn development server is running.
2. Run the command:
```powershell
# Inside backend/ directory
.\venv\Scripts\python.exe test_phase13.py
```
*Expected Output:*
```text
=== STARTING PHASE 13 (VOICE INPUT SUPPORT) INTEGRATION TESTS ===

1. Setting up test user: voice_owner_8540@easybiz.ai
[OK] User set up and token obtained.

2. Creating Business Profile
[OK] Business profile successfully created! ID: cc1f771e-3ee7-4a8f-b34f-097d891d2a74

3. Testing Speech-To-Text and Voice chat API endpoint
Testing Hours file transcription...
Hours file status: 200
Hours transcription: What are your opening hours?
...
[OK] Speech-to-Text and voice RAG pipeline verified successfully!

=======================================================
[SUCCESS] ALL PHASE 13 BACKEND INTEGRATION TESTS PASSED!
=======================================================
```
