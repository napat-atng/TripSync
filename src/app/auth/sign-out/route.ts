import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
  const supabase = createRouteSupabaseClient(request, response);
  await supabase.auth.signOut();
  return response;
}
