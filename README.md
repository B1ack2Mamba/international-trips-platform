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
