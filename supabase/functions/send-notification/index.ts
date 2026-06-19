import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  userIds: string[];      // public.users.id (not member_id)
  title: string;
  body: string;
  data?: Record<string, string>; // extra data sent to the app (e.g. { tripId, screen })
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound: "default";
  priority: "high";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload: NotificationPayload = await req.json();
    const { userIds, title, body, data } = payload;

    if (!userIds?.length || !title || !body) {
      return new Response(JSON.stringify({ error: "userIds, title, and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch push tokens for the requested users (only non-null tokens)
    const { data: users, error } = await supabase
      .from("users")
      .select("id, push_token")
      .in("id", userIds)
      .not("push_token", "is", null);

    if (error) throw error;

    const tokens: string[] = (users ?? [])
      .map((u: any) => u.push_token as string)
      .filter((t) => t.startsWith("ExponentPushToken["));

    if (tokens.length === 0) {
      // No registered devices — not an error, just nothing to send
      return new Response(JSON.stringify({ sent: 0, skipped: userIds.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Expo push messages (max 100 per request per Expo docs)
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: "default",
      priority: "high",
    }));

    // Send to Expo Push API in chunks of 100
    const chunkSize = 100;
    let totalSent = 0;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
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
        const errText = await res.text();
        console.error("Expo push error:", errText);
        // Continue with remaining chunks even if one fails
      } else {
        totalSent += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, total: tokens.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
