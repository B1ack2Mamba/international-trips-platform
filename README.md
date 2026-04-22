# international-trips-platform

## Message dispatch

The CRM writes outgoing messages to `message_outbox`. The dispatcher supports:

- `internal` messages, which are marked as sent inside the app.
- Email delivery through Resend or SendGrid.
- A generic webhook through `MESSAGE_DISPATCH_WEBHOOK_URL`.
- Dry-run mode through `MESSAGE_DISPATCH_DRY_RUN=true`.

Email environment examples:

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
RESEND_FROM_EMAIL=crm@example.com
RESEND_FROM_NAME="International Trips"
```

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=crm@example.com
SENDGRID_FROM_NAME="International Trips"
```

`EMAIL_FROM` and `EMAIL_FROM_NAME` can be used as shared fallback values for either provider.

Incoming replies can be written to `message_inbox` through:

- The "Связь с клиентом" block in a lead card.
- `POST /api/inbound-message` with `Authorization: Bearer $MESSAGE_INBOUND_WEBHOOK_TOKEN`.

Inbound webhook JSON:

```json
{
  "channel": "email",
  "sender_email": "client@example.com",
  "subject": "Re: договор",
  "body": "Готовы подписать",
  "provider": "resend",
  "external_message_id": "provider-message-id"
}
```

If `lead_id` is not provided, the API tries to match the lead by sender email or phone.

Lead communication automation:

- Taking a lead creates a first-contact task due in 2 hours.
- Sending a message creates a follow-up task due in 24 hours.
- Receiving an inbound reply creates a high-priority reply task due in 1 hour.
