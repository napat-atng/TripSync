import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/features/access/safe-next-path";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const origin = request.nextUrl.origin;

  if (!code) return NextResponse.redirect(new URL("/auth/error", origin));

  const response = NextResponse.redirect(new URL(next, origin));
  const supabase = createRouteSupabaseClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(new URL("/auth/error", origin));
  return response;
}
