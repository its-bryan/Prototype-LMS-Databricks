// Hertz LMS - Send email via Resend API
// Called from lead profile Contact section. Uses Resend sandbox for development.
// Emails use Hertz-branded HTML template.

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Hertz <onboarding@resend.dev>"; // Resend sandbox; use verified domain in prod

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailBody {
  leadId: number;
  to: string;
  subject?: string;
  body?: string;
  customer?: string;
  reservationId?: string;
  branch?: string;
  performedBy?: string;
  performedByName?: string;
}

function defaultSubject(reservationId: string) {
  return `Your Hertz reservation – ${reservationId}`;
}

function defaultBody(customer: string, branch: string, reservationId: string) {
  return `Hi ${customer},

This is ${branch} regarding your Hertz reservation ${reservationId}.

Please contact us if you have any questions about your rental.

Thank you,
Hertz`;
}

// Base64-encoded hertz-logo.svg (yellow badge with HERTZ text). Fallback alt for clients that block images.
const HERTZ_LOGO_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgNDAiIGZpbGw9Im5vbmUiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIHJ4PSI0IiBmaWxsPSIjRkZEMTAwIi8+PHRleHQgeD0iNjAiIHk9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiMxQTFBMUEiIGxldHRlci1zcGFjaW5nPSIyIj5IRVJUWzwvdGV4dD48L3N2Zz4=";

/** Hertz-branded HTML email template. Uses inline styles for email client compatibility. */
function buildHertzEmailHtml(customer: string, branch: string, reservationId: string, bodyOverride?: string): string {
  const bodyContent = bodyOverride ?? defaultBody(customer, branch, reservationId);
  const bodyHtml = bodyContent.replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hertz - Your Reservation</title>
</head>
<body style="margin:0; padding:0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F2F2F2; color: #272425;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F2F2F2; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(39, 36, 37, 0.08);">
          <!-- Hertz header with logo -->
          <tr>
            <td style="background-color: #272425; padding: 24px 32px; text-align: center;">
              <img src="${HERTZ_LOGO_DATA_URI}" alt="Hertz" width="120" height="40" style="display:block; margin:0 auto; border:0; outline:none; text-decoration:none;" />
            </td>
          </tr>
          <!-- Body content -->
          <tr>
            <td style="padding: 32px; font-size: 16px; line-height: 1.6; color: #272425;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F8F8; padding: 20px 32px; font-size: 13px; color: #666666; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 8px 0;">Thank you for choosing Hertz.</p>
              <p style="margin: 0;">© Hertz. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as SendEmailBody;
    const { to, subject, body: bodyOverride, customer = "Customer", reservationId = "", branch = "your branch" } = body;

    if (!to || !to.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid email address required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalSubject = subject ?? defaultSubject(reservationId);
    const finalHtml = buildHertzEmailHtml(customer, branch, reservationId, bodyOverride);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: finalSubject,
        html: finalHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.message ?? "Resend API error" }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Persist activity and update lead last_activity (including full email content)
    const plainBody = bodyOverride ?? defaultBody(customer, branch, reservationId);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from("lead_activities").insert({
        lead_id: body.leadId,
        type: "email",
        performed_by: body.performedBy || null,
        performed_by_name: body.performedByName || null,
        metadata: {
          id: data.id,
          subject: finalSubject,
          body: plainBody,
          to,
        },
      });
      await supabase.from("leads").update({ last_activity: new Date().toISOString() }).eq("id", body.leadId);
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
