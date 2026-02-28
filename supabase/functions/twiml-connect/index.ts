// Hertz LMS - TwiML endpoint for Twilio click-to-call
// When BM answers, Twilio fetches this URL and we return TwiML to dial the customer.
// Called by Twilio (not the frontend). No auth required — customer phone is in URL.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const customerPhone = url.searchParams.get("to");

  if (!customerPhone) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, no customer number.</Say></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }

  // TwiML: connect BM (who just answered) to customer
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to the customer now.</Say>
  <Dial>${customerPhone}</Dial>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
});
