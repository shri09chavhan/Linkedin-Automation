
# LinkedIn Automation

Simple React dashboard for the local LinkedIn automation backend.

## Run

```bash
npm install
npm run build
npm run serve
```

The app expects the backend at `http://localhost:5050`. To change it, create `.env` in this folder:

```bash
VITE_API_URL=http://localhost:5050
```

Email sending uses Resend from the backend. Add these values to `linked_automation_backend/.env`:

```bash
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=LinkedIn Automation <onboarding@resend.dev>
EMAIL_USER=reply_to_email@example.com
```
