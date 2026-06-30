import { NextRequest, NextResponse } from "next/server";
import { createNote, listNoteSummaries } from "@/lib/notes-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const notes = await listNoteSummaries();
    return NextResponse.json(notes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to list notes:", message, err);
    return NextResponse.json(
      { error: "Failed to list notes", detail: message },
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to create note:", message, err);
    return NextResponse.json(
      { error: "Failed to create note", detail: message },
      { status: 500 }
    );
  }
}
