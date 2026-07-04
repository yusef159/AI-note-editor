import { NextRequest, NextResponse } from "next/server";
import { createNoteGroup, listNoteGroups } from "@/lib/notes-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const groups = await listNoteGroups();
    return NextResponse.json(groups);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to list note groups:", message, err);
    return NextResponse.json(
      { error: "Failed to list note groups", detail: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Untitled group";
    const group = await createNoteGroup(name);
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to create note group:", message, err);
    return NextResponse.json(
      { error: "Failed to create note group", detail: message },
      { status: 500 }
    );
  }
}
