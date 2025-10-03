import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/db/context";
import { createClient } from "@/lib/db/clients";

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const ctx = await getAuthContext();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("clients")
      .select(`
        *,
        policies (
          id,
          policy_number,
          ramo,
          status,
          renewal_date
        )
      `)
      .order("name", { ascending: true });

    // Apply broker filter if not master
    if (ctx.role !== "master" && ctx.brokerId) {
      query = query.eq("broker_id", ctx.brokerId);
    }

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,national_id.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range(from, to)
      .returns<any[]>();

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      page,
      pageSize
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await createClient(body);
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error creating client" },
      { status: 500 }
    );
  }
}
