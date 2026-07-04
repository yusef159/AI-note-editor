import { NextRequest, NextResponse } from "next/server";
import {
  deleteNoteGroup,
  isValidNoteGroupId,
  updateNoteGroup,
} from "@/lib/notes-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function invalidIdResponse() {
  return NextResponse.json({ error: "Invalid note group id" }, { status: 400 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidNoteGroupId(id)) return invalidIdResponse();

  try {
    const body = await request.json();
    if (typeof body.name !== "string") {
      return NextResponse.json(
        { error: "name must be a string" },
        { status: 400 }
      );
    }

    const group = await updateNoteGroup(id, body.name);
    if (!group) {
      return NextResponse.json(
        { error: "Note group not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(group);
  } catch (err) {
    console.error("Failed to update note group:", err);
    return NextResponse.json(
      { error: "Failed to update note group" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidNoteGroupId(id)) return invalidIdResponse();

  try {
    const deleted = await deleteNoteGroup(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Note group not found" },
        { status: 404 }
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete note group:", err);
    return NextResponse.json(
      { error: "Failed to delete note group" },
      { status: 500 }
    );
  }
}
