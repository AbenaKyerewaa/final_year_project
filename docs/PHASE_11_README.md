# Phase 11 Documentation: Business Dashboard Chat Testing and History

This document tracks the deliverables, schema mappings, security rules, and verification procedures for **Phase 11: Business Dashboard Chat Testing and History** of EasyBiz AI.

---

## Objectives Completed

1.  **AI Test Console:**
    *   Designed an interactive test console under `/dashboard/chat-test`.
    *   Allows business owners to simulate user conversations and check answers before publishing.
    *   Logs messages using the `test` channel.
    *   Provides diagnostic detail displays showing confidence scores and the exact source database chunks used in similarity searches.

2.  **Session & Handoff History:**
    *   Created the customer history view under `/dashboard/chat-history`.
    *   Lists conversation logs categorized by Customer Name/Anonymous, Channel (web, test, WhatsApp), Date/Time, and Handoff Escalation status.
    *   Provides tabs separating general sessions and active pending handoff escalations.
    *   Enables owners to resolve active escalations with a single click.

3.  **Conversation Transcript Viewer:**
    *   Built session detail route `/dashboard/chat-history/[sessionId]`.
    *   Visualizes full customer-to-AI dialog transcripts with sender bubbles.
    *   Displays uvicorn similarity logs and database chunk source titles for auditing AI behavior.
    *   Allows resolving escalations directly from the detail transcript view.

4.  **Backend History & Handoff Management APIs:**
    *   Implemented endpoints:
        *   `GET /businesses/{business_id}/chat-sessions` — Lists history summaries.
        *   `GET /chat-sessions/{session_id}` — Lists messages transcript.
        *   `GET /businesses/{business_id}/escalations` — Lists escalations.
        *   `PUT /escalations/{escalation_id}` — Resolves or updates escalation status.
    *   Enforced business access check: Only authenticated owners, staff, or admins associated with the target business profile can view or update these records.

---

## API Documentation

### 1. `GET /businesses/{business_id}/chat-sessions`
*   **Access:** Restricted (Owner, Staff, Admin)
*   **Response Payload Schema:**
    ```json
    [
      {
        "id": "e68b2197-2221-4bb1-8d9a-e0460f7c6bc4",
        "customer_name": "Test User Owner",
        "customer_phone": null,
        "channel": "test",
        "created_at": "2026-06-25T01:15:45",
        "latest_message": "What are your opening hours?",
        "escalated": true,
        "escalation_status": "pending"
      }
    ]
    ```

### 2. `GET /chat-sessions/{session_id}`
*   **Access:** Restricted (Owner, Staff, Admin)
*   **Response Payload Schema:**
    ```json
    {
      "id": "e68b2197-2221-4bb1-8d9a-e0460f7c6bc4",
      "business_id": "3625fc62-82db-4eb7-ad3c-e07e8c4a6f64",
      "customer_name": "Test User Owner",
      "customer_phone": null,
      "channel": "test",
      "created_at": "2026-06-25T01:15:45",
      "escalated": true,
      "escalation_status": "pending",
      "messages": [
        {
          "id": "1a2b3c4d-...",
          "sender": "customer",
          "message": "What are your opening hours?",
          "confidence_score": null,
          "ai_response_source": null,
          "created_at": "2026-06-25T01:15:45"
        },
        {
          "id": "2e3f4g5h-...",
          "sender": "ai",
          "message": "We are open Monday - Saturday from 8:00 AM to 6:00 PM.",
          "confidence_score": 1.0,
          "ai_response_source": "[{\"title\": \"Business Profile\", ...}]",
          "created_at": "2026-06-25T01:15:45"
        }
      ]
    }
    ```

---

## File Structure Scaffolded in Phase 11

```text
EasyBiz-ai/
  backend/
    app/
      chat/
        routes.py           # Implemented dashboard_router and history / escalation routes
      main.py               # Registered dashboard_router
    test_phase11.py         # [NEW] Integration test suite for history API endpoints
  frontend/
    services/
      chat.ts               # Added history, details, and escalations API fetchers
    app/
      dashboard/
        layout.tsx          # Unlocked Chat Test and Chat History sidebar navigation links
        chat-test/
          page.tsx          # [NEW] Interactive AI Simulator UI page
        chat-history/
          page.tsx          # [NEW] Conversations list and Escalations center UI page
          [sessionId]/
            page.tsx        # [NEW] Session transcripts and source inspector UI page
```

---

## Verification Guide

### 1. Run Backend Automated Suite
Launch the dev server if not already running, then execute the following command:
```bash
# Inside backend/ directory
.\venv\Scripts\python.exe test_phase11.py
```
*Expected Output:*
```text
=== STARTING PHASE 11 (DASHBOARD CHAT HISTORY & TESTING) INTEGRATION TESTS ===

1. Logging in as Kojo...
[OK] Logged in successfully. Business ID: 3625fc62-82db-4eb7-ad3c-e07e8c4a6f64

2. Creating a test chat session (channel = 'test')...
[OK] Created chat session ID: e68b2197-2221-4bb1-8d9a-e0460f7c6bc4

3. Listing chat sessions for business...
Total sessions returned: 7
[OK] Session summary list verified!

4. Fetching details for session e68b2197-2221-4bb1-8d9a-e0460f7c6bc4...
Session detail response:
Customer Name: Test User Owner
Channel: test
Total messages count: 2
[OK] Session detail and message history verified!

5. Fetching escalations list...
Total escalations retrieved: 12

6. Updating escalation status (resolving escalation f656e2ae-427b-4c9a-8690-6df7e9fd5fb0)...
Updated status: resolved
[OK] Escalation status successfully updated/resolved!

7. Verifying security: unauthenticated access blocks...
[OK] Unauthenticated queries successfully blocked with 401.

=======================================================
[SUCCESS] ALL PHASE 11 BACKEND INTEGRATION TESTS PASSED!
=======================================================
```

### 2. Manual Frontend Console Verification
1. Open the EasyBiz AI Owner Dashboard ([http://localhost:3000/dashboard](http://localhost:3000/dashboard)) and log in.
2. In the left navigation menu, click **Chat Test**:
   * Send a test message (e.g. *"What products do you sell?"*).
   * Confirm the AI answers and displays the **Confidence Score**.
   * Click **Inspect Retrieval Sources** under the reply to check the source file chunks.
3. In the left navigation menu, click **Chat History**:
   * Review list of chat sessions and verify details (name, channel, time, latest message).
   * Click **Handoff Escalations** tab to view handoff flags.
   * Click **Mark Resolved** on a pending item to close the support escalation.
   * Click **View Transcript** to inspect full dialogue text.
