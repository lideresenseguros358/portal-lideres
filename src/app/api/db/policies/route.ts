import { NextRequest, NextResponse } from "next/server";
import { createPolicy } from "@/lib/db/policies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const policy = await createPolicy(body);
    return NextResponse.json(policy);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error creating policy" },
      { status: 500 }
    );
  }
}
