import { NextRequest, NextResponse } from "next/server";
import { updateClient, deleteClient, getClient } from "@/lib/db/clients";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { clientId } = await context.params;
    const client = await getClient(clientId);
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching client" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const body = await request.json();
    const { clientId } = await context.params;
    const client = await updateClient(clientId, body);
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error updating client" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { clientId } = await context.params;
    await deleteClient(clientId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error deleting client" },
      { status: 500 }
    );
  }
}
