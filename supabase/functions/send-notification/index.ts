import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: "default";
  priority: "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload: SendPayload = await req.json();
    const { userIds, title, body, data } = payload;

    if (!userIds?.length || !title || !body) {
      return new Response(
        JSON.stringify({ error: "userIds, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----------------------------------------------------------------
    // 1. Fetch push tokens for requested user IDs
    // ----------------------------------------------------------------
    const { data: users, error: dbError } = await supabase
      .from("users")
      .select("id, push_token")
      .in("id", userIds)
      .not("push_token", "is", null);

    if (dbError) throw dbError;

    const tokens: { userId: string; token: string }[] = (users ?? [])
      .filter((u: any) => u.push_token?.startsWith("ExponentPushToken["))
      .map((u: any) => ({ userId: u.id, token: u.push_token }));

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: userIds.length, reason: "No valid push tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----------------------------------------------------------------
    // 2. Build Expo push messages
    // ----------------------------------------------------------------
    const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
      to: token,
      title,
      body,
      data: data ?? {},
      sound: "default",
      priority: "high",
    }));

    // ----------------------------------------------------------------
    // 3. Send to Expo Push API in chunks of 100
    // ----------------------------------------------------------------
    const CHUNK_SIZE = 100;
    const tickets: ExpoPushTicket[] = [];

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error("[send-notification] Expo API error:", await res.text());
        continue;
      }

      const result = await res.json();
      const chunkTickets: ExpoPushTicket[] = Array.isArray(result.data)
        ? result.data
        : [result.data];
      tickets.push(...chunkTickets);
    }

    // ----------------------------------------------------------------
    // 4. Log delivery summary
    // ----------------------------------------------------------------
    const okCount = tickets.filter((t) => t.status === "ok").length;
    const errCount = tickets.filter((t) => t.status === "error").length;

    const errors = tickets
      .filter((t) => t.status === "error")
      .map((t) => ({ message: t.message, error: t.details?.error }));

    if (errors.length > 0) {
      console.warn("[send-notification] Delivery errors:", JSON.stringify(errors));
    }

    console.log(
      `[send-notification] Sent to ${tokens.length} devices — ok: ${okCount}, error: ${errCount}`,
    );

    return new Response(
      JSON.stringify({ sent: okCount, failed: errCount, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-notification] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
