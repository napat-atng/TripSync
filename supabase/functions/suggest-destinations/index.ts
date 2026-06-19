import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TripContext {
  tripName: string;
  memberCount: number;
  budgetMin: number | null;
  budgetMax: number | null;
  bestDates: string[];
  preferredDestinations: string[];
  tripDurationDays: number | null;
  otherPreferences: string[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ----------------------------------------------------------------
    // 1. Auth — verify the caller is a logged-in user
    // ----------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tripId } = await req.json();
    if (!tripId) {
      return new Response(JSON.stringify({ error: "tripId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----------------------------------------------------------------
    // 2. Fetch trip context from DB (all queries run with service key
    //    so RLS doesn't block the edge function)
    // ----------------------------------------------------------------
    const [tripRes, membersRes, questionsRes, responsesRes, availabilityRes] = await Promise.all([
      supabase.from("trips").select("name, confirmed_date").eq("id", tripId).single(),
      supabase.from("trip_members").select("id, display_name").eq("trip_id", tripId),
      supabase.from("survey_questions").select("*").eq("trip_id", tripId).order("order_index"),
      supabase.from("survey_responses").select("question_id, answer, member_id").eq("trip_id", tripId),
      supabase
        .from("availability")
        .select("date, member_id")
        .eq("trip_id", tripId)
        .eq("available", true),
    ]);

    const trip = tripRes.data;
    const members = membersRes.data ?? [];
    const questions = questionsRes.data ?? [];
    const responses = responsesRes.data ?? [];
    const availability = availabilityRes.data ?? [];

    // ----------------------------------------------------------------
    // 3. Build trip context for the prompt
    // ----------------------------------------------------------------

    // Budget range from budget_range questions
    const budgetResponses = responses.filter((r) => {
      const q = questions.find((q) => q.id === r.question_id);
      return q?.type === "budget_range";
    }).map((r) => Number(r.answer)).filter((n) => !Number.isNaN(n));

    const budgetMin = budgetResponses.length > 0 ? Math.min(...budgetResponses) : null;
    const budgetMax = budgetResponses.length > 0 ? Math.max(...budgetResponses) : null;

    // Best dates — top 3 by overlap count
    const dateCounts = new Map<string, number>();
    for (const row of availability) {
      dateCounts.set(row.date, (dateCounts.get(row.date) ?? 0) + 1);
    }
    const bestDates = Array.from(dateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([date]) => date);

    // Preferred destinations from multiple_choice questions
    const destResponses = responses.filter((r) => {
      const q = questions.find((q) => q.id === r.question_id);
      return q?.type === "multiple_choice" && q.question.toLowerCase().includes("สถานที่");
    });
    const allDestVotes: string[] = destResponses.flatMap((r) =>
      Array.isArray(r.answer) ? r.answer : [],
    );
    const destCounts = new Map<string, number>();
    for (const d of allDestVotes) {
      destCounts.set(d, (destCounts.get(d) ?? 0) + 1);
    }
    const preferredDestinations = Array.from(destCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Trip duration from date_range answers
    const dateRangeAnswers = responses.filter((r) => {
      const q = questions.find((q) => q.id === r.question_id);
      return q?.type === "date_range";
    });
    const durations: number[] = dateRangeAnswers
      .map((r) => {
        const start = r.answer?.start ? new Date(r.answer.start) : null;
        const end = r.answer?.end ? new Date(r.answer.end) : null;
        if (start && end) {
          return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
        return null;
      })
      .filter((d): d is number => d !== null && d > 0);

    const tripDurationDays =
      durations.length > 0 ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length) : null;

    // Other preferences from text questions
    const textAnswers = responses.filter((r) => {
      const q = questions.find((q) => q.id === r.question_id);
      return q?.type === "text";
    }).map((r) => String(r.answer).trim()).filter(Boolean).slice(0, 5);

    const ctx: TripContext = {
      tripName: trip?.name ?? "Group trip",
      memberCount: members.length,
      budgetMin,
      budgetMax,
      bestDates,
      preferredDestinations,
      tripDurationDays,
      otherPreferences: textAnswers,
    };

    // ----------------------------------------------------------------
    // 4. Build Claude prompt
    // ----------------------------------------------------------------
    const budgetText =
      ctx.budgetMin !== null && ctx.budgetMax !== null
        ? `${ctx.budgetMin.toLocaleString()}–${ctx.budgetMax.toLocaleString()} THB per person`
        : "not specified";

    const datesText =
      ctx.bestDates.length > 0
        ? ctx.bestDates.join(", ")
        : "not specified";

    const destinationsText =
      ctx.preferredDestinations.length > 0
        ? ctx.preferredDestinations.join(", ")
        : "no specific preferences";

    const durationText =
      ctx.tripDurationDays !== null ? `${ctx.tripDurationDays} days` : "not specified";

    const prefsText =
      ctx.otherPreferences.length > 0
        ? ctx.otherPreferences.map((p) => `- ${p}`).join("\n")
        : "none";

    const prompt = `You are a friendly Thai travel planner. Suggest exactly 3 trip destinations for a group with the following information:

Trip name: ${ctx.tripName}
Group size: ${ctx.memberCount} people
Budget per person: ${budgetText}
Best available dates: ${datesText}
Preferred destinations mentioned: ${destinationsText}
Estimated duration: ${durationText}
Other preferences:
${prefsText}

Rules:
- Suggest destinations suitable for groups traveling from Thailand
- Respect the budget constraint strictly — estimated_cost_per_person must be within the budget range if provided
- Mix destination types if no strong preference is stated
- Respond ONLY with a valid JSON array, no preamble, no markdown fences, no explanation
- Each item must have exactly these fields:
  {
    "name": string (destination name in Thai or English),
    "description": string (2 sentences max, friendly Thai tone),
    "estimated_cost_per_person": number (THB, integer),
    "highlights": [string, string, string] (exactly 3 short highlights),
    "best_for": string (1 short phrase, e.g. "กลุ่มชอบธรรมชาติ")
  }`;

    // ----------------------------------------------------------------
    // 5. Call Claude API (key stored in Supabase secrets as ANTHROPIC_API_KEY)
    // ----------------------------------------------------------------
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return new Response(JSON.stringify({ error: "Claude API error", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? "[]";

    // Strip markdown fences if Claude ignored the instruction
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const suggestions = JSON.parse(cleaned);

    // ----------------------------------------------------------------
    // 6. Persist suggestions to trips.ai_suggestions (jsonb) for members
    // ----------------------------------------------------------------
    await supabase
      .from("trips")
      .update({ ai_suggestions: suggestions })
      .eq("id", tripId);

    return new Response(
      JSON.stringify({
        suggestions,
        generated_at: new Date().toISOString(),
        trip_id: tripId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
