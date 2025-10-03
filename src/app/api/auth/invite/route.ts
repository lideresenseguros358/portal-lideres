import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/env";

const BodySchema = z.object({
  emails: z.array(z.string().email()).nonempty(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const master = req.headers.get("x-master-token");
    if (!master || master !== env.MASTER_INVITE_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { emails } = BodySchema.parse(await req.json());
    const unique = Array.from(new Set(emails.map((email) => email.toLowerCase())));
    const supabase = getSupabaseAdmin();

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const email of unique) {
      const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      });
      if (error) {
        console.error("inviteUserByEmail:", email, error.message);
        results.push({ email, ok: false, error: error.message });
      } else {
        results.push({ email, ok: true });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("POST /api/auth/invite failed:", err);
    return NextResponse.json(
      { error: "Invalid request", details: err?.message ?? String(err) },
      { status: 400 }
    );
  }
}