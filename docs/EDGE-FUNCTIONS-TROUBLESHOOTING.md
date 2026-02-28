# Edge Functions Troubleshooting

## "Edge Function returned a non-2xx status code"

This generic error means the function returned 4xx or 5xx. The UI now shows the actual error from the function when possible. Common causes:

### 1. JWT verification (401)

By default, Edge Functions require a valid JWT. If you're not logged in or the session expired, the request fails before reaching the function.

**Fix:** Redeploy with `--no-verify-jwt`:

```bash
npx supabase functions deploy send-email --no-verify-jwt
npx supabase functions deploy send-sms --no-verify-jwt
npx supabase functions deploy initiate-call --no-verify-jwt
npx supabase functions deploy twiml-connect --no-verify-jwt
```

### 2. Missing or wrong secrets

Secrets must match exactly:

- `RESEND_API_KEY` — from Resend dashboard
- `TWILIO_ACCOUNT_SID` — from Twilio console
- `TWILIO_AUTH_TOKEN` — from Twilio console
- `TWILIO_PHONE_NUMBER` — your Twilio number (E.164, e.g. +14155551234)

Check: Supabase Dashboard → Project Settings → Edge Functions → Secrets

### 3. Resend sandbox limits

With `onboarding@resend.dev`, you can only send to **your own verified email**. Sending to other addresses returns an error.

**Fix:** Verify your domain in Resend and use a verified `from` address.

### 4. "Failed to initiate call" / Twilio errors

**Most common cause:** Twilio secrets are not set in Supabase. The `initiate-call` Edge Function runs on Supabase's servers and needs these secrets (not your local `.env`):

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **Edge Functions** → **Secrets**
2. Add:
   - `TWILIO_ACCOUNT_SID` — from [Twilio Console](https://console.twilio.com)
   - `TWILIO_AUTH_TOKEN` — from Twilio Console
   - `TWILIO_PHONE_NUMBER` — your Twilio phone number in E.164 format (e.g. `+14155551234`)

3. Redeploy the function: `npx supabase functions deploy initiate-call --no-verify-jwt`
4. Redeploy twiml-connect: `npx supabase functions deploy twiml-connect --no-verify-jwt`

**Other Twilio errors:**
- **Invalid "from" number:** Must be a Twilio number you own
- **Trial account:** Can only call verified numbers (verify your profile phone in Twilio Console)
- **Invalid "to" format:** Use E.164 (e.g. +14155551234)

### 5. View function logs

Supabase Dashboard → Edge Functions → select function → Logs

This shows the actual error (e.g. Resend API message, Twilio error).
