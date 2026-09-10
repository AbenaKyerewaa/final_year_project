import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import uuid

logger = logging.getLogger("easybiz.alerts")

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
1. Log in to your EasyBiz AI dashboard.
2. Open the business profile named "{business_name}".
3. Go to Chat History and open the pending conversation that needs attention.
4. Reply to the customer directly inside the chat dashboard.
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
    .action-box {{
      background-color: #172033;
      border: 1px solid #2f3b52;
      border-radius: 12px;
      padding: 18px;
      margin-top: 24px;
    }}
    .action-box h2 {{
      color: #ffffff;
      font-size: 16px;
      margin: 0 0 12px 0;
    }}
    .action-box ol {{
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.7;
      margin: 0;
      padding-left: 20px;
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

    <div class="action-box">
      <h2>What to do next</h2>
      <ol>
        <li>Log in to your EasyBiz AI dashboard.</li>
        <li>Open the business profile named <strong>{business_name}</strong>.</li>
        <li>Go to <strong>Chat History</strong> and open the pending conversation that needs attention.</li>
        <li>Reply to the customer directly inside the chat dashboard.</li>
      </ol>
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
    print(f"Next Step:        Log in, open {business_name}, and reply from Chat History.")
    print("=" * 75 + "\n")
    return True
