import { NextRequest, NextResponse } from "next/server";
import { createNote, listNoteSummaries } from "@/lib/notes-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const notes = await listNoteSummaries();
    return NextResponse.json(notes);
  } catch (err) {
    console.error("Failed to list notes:", err);
    return NextResponse.json(
      { error: "Failed to list notes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "Untitled note";
    const note = await createNote(title);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error("Failed to create note:", err);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
