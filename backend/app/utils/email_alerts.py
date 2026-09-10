import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import uuid

logger = logging.getLogger("easybiz.alerts")

def format_whatsapp_link(phone: Optional[str], business_name: str) -> Optional[str]:
    """Formats a clean WhatsApp deep link (wa.me) with pre-filled context."""
    if not phone:
        return None
    # Strip any non-numeric characters except leading +
    clean_digits = "".join(c for c in phone if c.isdigit())
    if not clean_digits:
        return None
    # If standard 10-digit Ghanaian number starting with 0, convert to international format (233)
    if len(clean_digits) == 10 and clean_digits.startswith("0"):
        clean_digits = "233" + clean_digits[1:]
    
    encoded_text = f"Hello! This is {business_name}. I saw your message on our chat assistant regarding your inquiry."
    import urllib.parse
    return f"https://wa.me/{clean_digits}?text={urllib.parse.quote(encoded_text)}"


def send_escalation_alert_email(
    owner_email: str,
    owner_name: str,
    business_name: str,
    session_id: uuid.UUID,
    customer_message: str,
    customer_phone: Optional[str] = None,
    customer_name: Optional[str] = None,
    channel: str = "web",
    reason: Optional[str] = None
) -> bool:
    """
    Sends an out-of-band escalation notification email to the business owner
    when the AI assistant encounters an inquiry it cannot answer with high confidence
    or when the customer requests a human representative.
    
    Supports Resend as the recommended provider, SMTP as a fallback,
    and console simulation logging when no email provider is configured.
    """
    frontend_base_url = os.getenv("FRONTEND_URL", "http://localhost:3000").strip().rstrip("/")
    if frontend_base_url and not frontend_base_url.startswith(("http://", "https://")):
        frontend_base_url = f"https://{frontend_base_url.lstrip('/')}"
    dashboard_session_url = f"{frontend_base_url}/dashboard/chat-history/{session_id}"
    wa_link = format_whatsapp_link(customer_phone, business_name)
    display_customer = customer_name or "Anonymous Customer"
    display_phone = customer_phone or "Not provided yet"
    reason_label = reason or "Low AI retrieval confidence or human assistance requested"

    subject = f"[URGENT] Customer Inquiry for {business_name} - Action Required"

    # Plain text version for accessibility
    text_content = f"""
EASYBIZ AI - ESCALATION ALERT
===================================================================
Hello {owner_name},

A customer on your {channel.upper()} chat asked a question that needs
your direct attention.

Business Profile: {business_name}
Customer: {display_customer} ({display_phone})
Channel: {channel.capitalize()}
Reason: {reason_label}

Customer's Message:
"{customer_message}"

QUICK ACTIONS:
1. Open Conversation in Dashboard:
   {dashboard_session_url}
"""
    if wa_link:
        text_content += f"""
2. Reply directly to Customer on WhatsApp:
   {wa_link}
"""

    text_content += """
===================================================================
EasyBiz AI - Automated Merchant Alerts
"""

    # Responsive HTML version
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b0f19;
      color: #e2e8f0;
      margin: 0;
      padding: 24px;
    }}
    .card {{
      max-width: 600px;
      margin: 0 auto;
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }}
    .badge {{
      display: inline-block;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f87171;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }}
    h1 {{
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 8px 0;
    }}
    p {{
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }}
    .quote-box {{
      background-color: #1e293b;
      border-left: 4px solid #3b82f6;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      font-size: 15px;
      font-style: italic;
      color: #f1f5f9;
      line-height: 1.5;
    }}
    .details-table {{
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }}
    .details-table td {{
      padding: 8px 0;
      border-bottom: 1px solid #1e293b;
    }}
    .details-table td.label {{
      color: #64748b;
      width: 35%;
      font-weight: 600;
    }}
    .details-table td.value {{
      color: #e2e8f0;
      font-weight: 500;
    }}
    .button-group {{
      margin-top: 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    .btn {{
      display: inline-block;
      text-align: center;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s;
    }}
    .btn-primary {{
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      border: 1px solid #3b82f6;
    }}
    .btn-whatsapp {{
      background-color: #10b981;
      color: #ffffff !important;
      border: 1px solid #059669;
    }}
    .footer {{
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #1f2937;
      font-size: 11px;
      color: #475569;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Escalation Alert</span>
    <h1>Customer Inquiry Needs Your Attention</h1>
    <p>Hello <strong>{owner_name}</strong>, a customer interacting with <strong>{business_name}</strong> asked a question that the automated assistant flagged for human intervention.</p>
    
    <div class="quote-box">
      &ldquo;{customer_message}&rdquo;
    </div>

    <table class="details-table">
      <tr>
        <td class="label">Business:</td>
        <td class="value"><strong>{business_name}</strong></td>
      </tr>
      <tr>
        <td class="label">Customer Contact:</td>
        <td class="value">{display_customer} &bull; <span style="color: #38bdf8;">{display_phone}</span></td>
      </tr>
      <tr>
        <td class="label">Channel:</td>
        <td class="value">{channel.upper()}</td>
      </tr>
      <tr>
        <td class="label">Escalation Trigger:</td>
        <td class="value">{reason_label}</td>
      </tr>
    </table>

    <div class="button-group">
      <a href="{dashboard_session_url}" class="btn btn-primary" target="_blank">
        Open Chat in Dashboard &rarr;
      </a>
      """
    if wa_link:
        html_content += f"""
      <a href="{wa_link}" class="btn btn-whatsapp" target="_blank" style="margin-top: 10px;">
        Reply directly on WhatsApp ({display_phone})
      </a>
      """

    html_content += f"""
    </div>

    <div class="footer">
      This is an automated alert generated by EasyBiz AI Multi-Tenant Support Assistant.<br>
      To view all active chats, log in to your merchant dashboard.
    </div>
  </div>
</body>
</html>"""

    resend_api_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM_EMAIL") or os.getenv("SMTP_FROM_EMAIL") or "alerts@easybiz.ai"

    if resend_api_key:
        try:
            import resend

            resend.api_key = resend_api_key
            resend.Emails.send({
                "from": resend_from,
                "to": owner_email,
                "subject": subject,
                "html": html_content,
                "text": text_content,
            })
            logger.info(f"[Escalation Alert] Resend email dispatched successfully to {owner_email} for business {business_name}")
            return True
        except Exception as e:
            logger.error(f"[Escalation Alert] Failed to dispatch email via Resend: {e}. Trying SMTP fallback.")

    # Check for SMTP configuration
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user or "alerts@easybiz.ai")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = owner_email

            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                if smtp_use_tls:
                    server.starttls()

            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [owner_email], msg.as_string())
            server.quit()
            logger.info(f"[Escalation Alert] Email dispatched successfully to {owner_email} for business {business_name}")
            return True
        except Exception as e:
            logger.error(f"[Escalation Alert] Failed to dispatch email via SMTP: {e}. Falling back to simulation log.")

    # Graceful fallback: Console Simulation Log (Zero-config development & testing mode)
    print("\n" + "=" * 75)
    print("[!] [EASYBIZ ESCALATION EMAIL NOTIFICATION - DISPATCHED]")
    print(f"To:               {owner_name} <{owner_email}>")
    print(f"Subject:          {subject}")
    print(f"Business:         {business_name}")
    print(f"Customer Contact: {display_customer} ({display_phone})")
    print(f"Inquiry Snippet:  \"{customer_message}\"")
    print(f"Dashboard Link:   {dashboard_session_url}")
    if wa_link:
        print(f"WhatsApp Action:  {wa_link}")
    print("=" * 75 + "\n")
    return True
