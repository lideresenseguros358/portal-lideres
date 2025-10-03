import { NextRequest, NextResponse } from "next/server";
import { updatePolicy, deletePolicy } from "@/lib/db/policies";

type RouteContext = { params: Promise<{ policyId: string }> };

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const body = await request.json();
    const { policyId } = await context.params;
    const policy = await updatePolicy(policyId, body);
    return NextResponse.json(policy);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error updating policy" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { policyId } = await context.params;
    await deletePolicy(policyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error deleting policy" },
      { status: 500 }
    );
  }
}
