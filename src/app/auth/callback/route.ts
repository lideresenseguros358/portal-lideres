import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "../../../lib/database.types";

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "role" | "must_change_password">;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const type = requestUrl.searchParams.get("type");

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const { data, error } = await supabase.auth.exchangeCodeForSession(requestUrl.toString());

  if (error || !data.session) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message ?? "auth_failed")}`, request.url)
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", data.session.user.id)
    .maybeSingle<ProfileRow>();

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/update-password", request.url));
  }

  const mustChange =
    (profile?.must_change_password ?? false) || data.session.user.user_metadata?.tempPassword === true;

  if (mustChange) {
    return NextResponse.redirect(new URL("/account?forcePassword=1", request.url));
  }

  return NextResponse.redirect(new URL("/", request.url));
}
