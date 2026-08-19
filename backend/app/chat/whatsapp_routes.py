import os
import json
import requests
from typing import Optional, Any, Dict

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Body,
    status,
)
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.businesses.models import Business
from app.chat.routes import process_rag_chat
from app.auth.security import get_current_user
from app.auth.models import User


router = APIRouter(
    prefix="/webhooks/whatsapp",
    tags=["whatsapp"]
)


# ============================================================
# PHONE HELPERS
# ============================================================

def normalize_phone(phone: str) -> str:
    if not phone:
        return ""

    return "".join(
        c for c in str(phone)
        if c.isdigit()
    )


def match_phone_numbers(phone1: str, phone2: str) -> bool:
    c1 = normalize_phone(phone1)
    c2 = normalize_phone(phone2)

    if not c1 or not c2:
        return False

    # Exact match
    if c1 == c2:
        return True

    # Ghana numbers:
    # +233241234567
    # 0241234567
    # 241234567
    #
    # Compare final 9 digits.
    if len(c1) >= 9 and len(c2) >= 9:
        return c1[-9:] == c2[-9:]

    return False


# ============================================================
# BUSINESS LOOKUP
# ============================================================

def get_business_by_whatsapp(
    db: Session,
    incoming_phone: str
) -> Optional[Business]:

    print(
        "\n========== WHATSAPP BUSINESS LOOKUP ==========",
        flush=True
    )

    print(
        f"[WhatsApp DBG] Incoming Meta display number: "
        f"'{incoming_phone}'",
        flush=True
    )

    all_businesses = db.query(Business).all()

    print(
        f"[WhatsApp DBG] Businesses found in database: "
        f"{len(all_businesses)}",
        flush=True
    )

    # --------------------------------------------------------
    # 1. Match business.whatsapp_number
    # --------------------------------------------------------

    for business in all_businesses:

        print(
            f"[WhatsApp DBG] Checking: "
            f"{business.business_name} | "
            f"WhatsApp={business.whatsapp_number} | "
            f"Phone={business.phone}",
            flush=True
        )

        if business.whatsapp_number:

            normalized_business = normalize_phone(
                business.whatsapp_number
            )

            normalized_incoming = normalize_phone(
                incoming_phone
            )

            matched = match_phone_numbers(
                business.whatsapp_number,
                incoming_phone
            )

            print(
                f"[WhatsApp DBG] Compare WhatsApp numbers: "
                f"{normalized_business} vs "
                f"{normalized_incoming} => {matched}",
                flush=True
            )

            if matched:

                print(
                    f"[WhatsApp DBG] MATCHED business by "
                    f"whatsapp_number: "
                    f"{business.business_name}",
                    flush=True
                )

                return business

    # --------------------------------------------------------
    # 2. Match normal business phone
    # --------------------------------------------------------

    for business in all_businesses:

        if business.phone:

            matched = match_phone_numbers(
                business.phone,
                incoming_phone
            )

            if matched:

                print(
                    f"[WhatsApp DBG] MATCHED business by "
                    f"regular phone: "
                    f"{business.business_name}",
                    flush=True
                )

                return business

    # --------------------------------------------------------
    # 3. Environment fallback
    # --------------------------------------------------------

    env_number = os.getenv(
        "WHATSAPP_BUSINESS_NUMBER",
        ""
    )

    if env_number:

        print(
            f"[WhatsApp DBG] Checking "
            f"WHATSAPP_BUSINESS_NUMBER env: "
            f"'{env_number}'",
            flush=True
        )

        if match_phone_numbers(
            env_number,
            incoming_phone
        ):

            print(
                "[WhatsApp DBG] Incoming number matches "
                "WHATSAPP_BUSINESS_NUMBER.",
                flush=True
            )

            # Find the business whose registered number
            # corresponds to that environment number.
            for business in all_businesses:

                if (
                    business.whatsapp_number
                    and match_phone_numbers(
                        business.whatsapp_number,
                        env_number
                    )
                ):

                    print(
                        f"[WhatsApp DBG] MATCHED business "
                        f"using env number: "
                        f"{business.business_name}",
                        flush=True
                    )

                    return business

                if (
                    business.phone
                    and match_phone_numbers(
                        business.phone,
                        env_number
                    )
                ):

                    print(
                        f"[WhatsApp DBG] MATCHED business "
                        f"using regular phone + env number: "
                        f"{business.business_name}",
                        flush=True
                    )

                    return business

    # --------------------------------------------------------
    # IMPORTANT:
    # Do NOT silently use first business anymore.
    # --------------------------------------------------------

    print(
        "[WhatsApp ERROR] Could not match incoming "
        "WhatsApp display number to any business.",
        flush=True
    )

    print(
        "==============================================\n",
        flush=True
    )

    return None


# ============================================================
# SEND WHATSAPP MESSAGE
# ============================================================

def send_whatsapp_reply(
    recipient_phone: str,
    message_text: str
):

    whatsapp_mode = os.getenv(
        "WHATSAPP_MODE",
        "simulation"
    ).lower()

    print(
        "\n========== WHATSAPP OUTGOING MESSAGE ==========",
        flush=True
    )

    print(
        f"[WhatsApp OUT] Mode: {whatsapp_mode}",
        flush=True
    )

    print(
        f"[WhatsApp OUT] Recipient: {recipient_phone}",
        flush=True
    )

    print(
        f"[WhatsApp OUT] Message: {message_text}",
        flush=True
    )

    # --------------------------------------------------------
    # Simulation
    # --------------------------------------------------------

    if whatsapp_mode != "cloud_api":

        print(
            f"[WhatsApp SIMULATION] Would send reply to "
            f"{recipient_phone}: '{message_text}'",
            flush=True
        )

        return True

    # --------------------------------------------------------
    # Cloud API
    # --------------------------------------------------------

    phone_number_id = os.getenv(
        "WHATSAPP_PHONE_NUMBER_ID"
    )

    access_token = os.getenv(
        "WHATSAPP_ACCESS_TOKEN"
    )

    if not phone_number_id:

        print(
            "[WhatsApp ERROR] "
            "WHATSAPP_PHONE_NUMBER_ID is missing.",
            flush=True
        )

        return False

    if not access_token:

        print(
            "[WhatsApp ERROR] "
            "WHATSAPP_ACCESS_TOKEN is missing.",
            flush=True
        )

        return False

    print(
        f"[WhatsApp OUT] Using Phone Number ID: "
        f"{phone_number_id}",
        flush=True
    )

    # Do not print access token.

    url = (
        f"https://graph.facebook.com/"
        f"v19.0/{phone_number_id}/messages"
    )

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": normalize_phone(recipient_phone),
        "type": "text",
        "text": {
            "preview_url": False,
            "body": message_text,
        },
    }

    print(
        f"[WhatsApp OUT] Graph endpoint: {url}",
        flush=True
    )

    try:

        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=20,
        )

        print(
            f"[WhatsApp OUT] Meta response status: "
            f"{response.status_code}",
            flush=True
        )

        print(
            f"[WhatsApp OUT] Meta response body: "
            f"{response.text}",
            flush=True
        )

        if response.status_code in (200, 201):

            print(
                f"[WhatsApp SUCCESS] Reply successfully "
                f"sent to {recipient_phone}",
                flush=True
            )

            return True

        print(
            f"[WhatsApp ERROR] Facebook API error "
            f"{response.status_code}: "
            f"{response.text}",
            flush=True
        )

        return False

    except requests.RequestException as exc:

        print(
            f"[WhatsApp ERROR] Graph API request failed: "
            f"{exc}",
            flush=True
        )

        return False

    except Exception as exc:

        print(
            f"[WhatsApp ERROR] Unexpected outgoing "
            f"message error: {exc}",
            flush=True
        )

        return False


# ============================================================
# DASHBOARD WHATSAPP CONFIG
# ============================================================

@router.get("/config")
def get_whatsapp_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # Set this on Render:
    #
    # BACKEND_PUBLIC_URL=https://your-api.onrender.com

    backend_public_url = os.getenv(
        "BACKEND_PUBLIC_URL",
        "http://127.0.0.1:8000"
    ).rstrip("/")

    return {
        "whatsappMode": os.getenv(
            "WHATSAPP_MODE",
            "simulation"
        ).lower(),

        "verifyTokenConfigured": bool(
            os.getenv("WHATSAPP_VERIFY_TOKEN")
        ),

        "phoneNumberId": os.getenv(
            "WHATSAPP_PHONE_NUMBER_ID",
            ""
        ),

        "businessNumber": os.getenv(
            "WHATSAPP_BUSINESS_NUMBER",
            ""
        ),

        "backendWebhookUrl":
            f"{backend_public_url}/webhooks/whatsapp",
    }


# ============================================================
# META WEBHOOK VERIFICATION
# ============================================================

@router.get("", response_class=PlainTextResponse)
@router.get("/", response_class=PlainTextResponse)
def verify_webhook(

    hub_mode: Optional[str] = Query(
        None,
        alias="hub.mode"
    ),

    hub_challenge: Optional[str] = Query(
        None,
        alias="hub.challenge"
    ),

    hub_verify_token: Optional[str] = Query(
        None,
        alias="hub.verify_token"
    ),
):

    print(
        "\n========== WHATSAPP WEBHOOK VERIFY ==========",
        flush=True
    )

    print(
        f"[WhatsApp VERIFY] mode={hub_mode}",
        flush=True
    )

    print(
        f"[WhatsApp VERIFY] challenge="
        f"{hub_challenge}",
        flush=True
    )

    whatsapp_mode = os.getenv(
        "WHATSAPP_MODE",
        "simulation"
    ).lower()

    if whatsapp_mode == "disabled":

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp is disabled",
        )

    verify_token = os.getenv(
        "WHATSAPP_VERIFY_TOKEN",
        ""
    )

    if (
        hub_mode == "subscribe"
        and hub_verify_token == verify_token
    ):

        print(
            "[WhatsApp VERIFY] Webhook verification "
            "SUCCESS.",
            flush=True
        )

        return hub_challenge

    print(
        "[WhatsApp VERIFY] Verification FAILED.",
        flush=True
    )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification token mismatch",
    )


# ============================================================
# RECEIVE META WHATSAPP WEBHOOK
# ============================================================

@router.post("")
@router.post("/")
async def receive_webhook(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    # ========================================================
    # FIRST LOG: proves that Render/FastAPI received the POST
    # ========================================================
    print(
        "\n\n##################################################",
        flush=True
    )
    print(
        "### WHATSAPP POST WEBHOOK HIT ###",
        flush=True
    )
    print(
        f"Request URL: {request.url}",
        flush=True
    )
    print(
        f"Request method: {request.method}",
        flush=True
    )
    print(
        "##################################################",
        flush=True
    )

    whatsapp_mode = os.getenv(
        "WHATSAPP_MODE",
        "simulation"
    ).lower()

    print(
        f"[WhatsApp WEBHOOK] Current mode: {whatsapp_mode}",
        flush=True
    )

    if whatsapp_mode == "disabled":
        print(
            "[WhatsApp WEBHOOK] WhatsApp disabled.",
            flush=True
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp is disabled",
        )

    # FastAPI has already parsed the JSON body into `payload`.
    # Declaring Body(...) makes Swagger show a Request body box.
    print(
        "[WhatsApp WEBHOOK] Parsed payload:",
        flush=True
    )
    print(
        json.dumps(payload, indent=2),
        flush=True
    )

    # ========================================================
    # CHECK OBJECT TYPE
    # ========================================================
    object_type = payload.get("object")

    print(
        f"[WhatsApp WEBHOOK] object={object_type}",
        flush=True
    )

    if object_type != "whatsapp_business_account":
        print(
            "[WhatsApp WEBHOOK] Ignoring payload because "
            "object is not whatsapp_business_account.",
            flush=True
        )
        return {
            "status": "ignored",
            "reason": "not a whatsapp business account",
        }

    entries = payload.get("entry", [])

    print(
        f"[WhatsApp WEBHOOK] Entries found: {len(entries)}",
        flush=True
    )

    # ========================================================
    # PROCESS ENTRIES
    # ========================================================
    for entry_index, entry in enumerate(entries):
        print(
            f"[WhatsApp WEBHOOK] Processing entry {entry_index + 1}",
            flush=True
        )

        changes = entry.get("changes", [])

        print(
            f"[WhatsApp WEBHOOK] Changes found: {len(changes)}",
            flush=True
        )

        for change_index, change in enumerate(changes):
            print(
                f"[WhatsApp WEBHOOK] Processing change {change_index + 1}",
                flush=True
            )
            print(
                f"[WhatsApp WEBHOOK] Change field: {change.get('field')}",
                flush=True
            )

            value = change.get("value", {})
            metadata = value.get("metadata", {})

            display_phone_number = metadata.get(
                "display_phone_number",
                ""
            )
            meta_phone_number_id = metadata.get(
                "phone_number_id",
                ""
            )

            print(
                f"[WhatsApp WEBHOOK] Meta display number: "
                f"{display_phone_number}",
                flush=True
            )
            print(
                f"[WhatsApp WEBHOOK] Meta phone_number_id: "
                f"{meta_phone_number_id}",
                flush=True
            )

            # =================================================
            # CONTACT INFORMATION
            # =================================================
            contacts = value.get("contacts", [])
            customer_name = "WhatsApp Customer"

            if contacts:
                customer_name = (
                    contacts[0]
                    .get("profile", {})
                    .get("name", "WhatsApp Customer")
                )

            print(
                f"[WhatsApp WEBHOOK] Customer name: "
                f"{customer_name}",
                flush=True
            )

            # =================================================
            # MESSAGES
            # =================================================
            messages = value.get("messages", [])

            print(
                f"[WhatsApp WEBHOOK] Messages found: "
                f"{len(messages)}",
                flush=True
            )

            # Status events may also hit this webhook.
            if not messages:
                statuses = value.get("statuses", [])

                if statuses:
                    print(
                        "[WhatsApp WEBHOOK] This is a "
                        "message-status event, not a new "
                        "customer message.",
                        flush=True
                    )
                    print(
                        json.dumps(statuses, indent=2),
                        flush=True
                    )

                continue

            # =================================================
            # PROCESS CUSTOMER MESSAGES
            # =================================================
            for msg_index, msg in enumerate(messages):
                print(
                    f"\n[WhatsApp WEBHOOK] Processing "
                    f"message {msg_index + 1}",
                    flush=True
                )

                message_type = msg.get("type", "")
                sender_phone = msg.get("from", "")
                message_id = msg.get("id", "")

                print(
                    f"[WhatsApp WEBHOOK] Message ID: "
                    f"{message_id}",
                    flush=True
                )
                print(
                    f"[WhatsApp WEBHOOK] Type: "
                    f"{message_type}",
                    flush=True
                )
                print(
                    f"[WhatsApp WEBHOOK] Sender: "
                    f"{sender_phone}",
                    flush=True
                )

                # EasyBiz currently processes text messages.
                if message_type != "text":
                    print(
                        f"[WhatsApp WEBHOOK] Ignoring "
                        f"unsupported message type: "
                        f"{message_type}",
                        flush=True
                    )
                    continue

                body = (
                    msg.get("text", {})
                    .get("body", "")
                    .strip()
                )

                print(
                    f"[WhatsApp WEBHOOK] Text: '{body}'",
                    flush=True
                )

                if not body:
                    print(
                        "[WhatsApp WEBHOOK] Empty text "
                        "message. Ignoring.",
                        flush=True
                    )
                    continue

                # =============================================
                # 1. FIND BUSINESS
                # =============================================
                business = get_business_by_whatsapp(
                    db,
                    display_phone_number
                )

                if not business:
                    print(
                        f"[WhatsApp ERROR] No business "
                        f"matched Meta number "
                        f"{display_phone_number}.",
                        flush=True
                    )
                    continue

                print(
                    f"[WhatsApp SUCCESS] Business matched: "
                    f"{business.business_name} "
                    f"(ID={business.id})",
                    flush=True
                )

                # =============================================
                # 2. RAG PROCESSING
                # =============================================
                try:
                    print(
                        "[WhatsApp RAG] Sending message "
                        "into EasyBiz RAG pipeline...",
                        flush=True
                    )

                    result = process_rag_chat(
                        db=db,
                        business_id=business.id,
                        message=body,
                        channel="whatsapp",
                        customer_name=customer_name,
                        customer_phone=sender_phone,
                    )

                    print(
                        "[WhatsApp RAG] RAG processing completed.",
                        flush=True
                    )
                    print(
                        f"[WhatsApp RAG] Result: {result}",
                        flush=True
                    )

                except Exception as exc:
                    print(
                        f"[WhatsApp RAG ERROR] "
                        f"process_rag_chat failed: "
                        f"{type(exc).__name__}: {exc}",
                        flush=True
                    )
                    # Return 200 to Meta after logging the error so
                    # repeated delivery does not create a retry loop.
                    continue

                # =============================================
                # 3. EXTRACT ANSWER
                # =============================================
                if isinstance(result, dict):
                    answer = result.get("answer", "")
                else:
                    # Supports a Pydantic/object response as well.
                    answer = getattr(result, "answer", "")

                if not answer:
                    print(
                        "[WhatsApp ERROR] RAG response "
                        "contained no answer.",
                        flush=True
                    )
                    continue

                print(
                    f"[WhatsApp RAG] Answer: '{answer}'",
                    flush=True
                )

                # =============================================
                # 4. SEND WHATSAPP REPLY
                # =============================================
                sent = send_whatsapp_reply(
                    sender_phone,
                    answer
                )

                print(
                    f"[WhatsApp WEBHOOK] Reply send "
                    f"result: {sent}",
                    flush=True
                )

    print(
        "\n[WhatsApp WEBHOOK] Processing complete.",
        flush=True
    )

    return {"status": "success"}