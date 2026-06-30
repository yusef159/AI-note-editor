import { NextRequest, NextResponse } from "next/server";
import {
  deleteNote,
  getNote,
  isValidNoteId,
  updateNote,
  type ServerNote,
} from "@/lib/notes-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function invalidIdResponse() {
  return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidNoteId(id)) return invalidIdResponse();

  try {
    const note = await getNote(id);
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json(note);
  } catch (err) {
    console.error("Failed to get note:", err);
    return NextResponse.json(
      { error: "Failed to get note" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidNoteId(id)) return invalidIdResponse();

  try {
    const body = await request.json();
    const updates: {
      title?: string;
      content?: ServerNote["content"];
    } = {};

    if (typeof body.title === "string") {
      updates.title = body.title;
    }

    if (body.content && typeof body.content === "object") {
      const html = body.content.html;
      const images = body.content.images;

      if (typeof html !== "string") {
        return NextResponse.json(
          { error: "content.html must be a string" },
          { status: 400 }
        );
      }

      if (images !== undefined && (typeof images !== "object" || !images)) {
        return NextResponse.json(
          { error: "content.images must be an object" },
          { status: 400 }
        );
      }

      const parsedImages: ServerNote["content"]["images"] = {};
      if (images) {
        for (const [imageId, image] of Object.entries(images)) {
          if (
            !image ||
            typeof image !== "object" ||
            typeof (image as { data?: unknown }).data !== "string" ||
            typeof (image as { mimeType?: unknown }).mimeType !== "string"
          ) {
            return NextResponse.json(
              { error: "Invalid image entry" },
              { status: 400 }
            );
          }
          parsedImages[imageId] = {
            data: (image as { data: string }).data,
            mimeType: (image as { mimeType: string }).mimeType,
          };
        }
      }

      updates.content = { html, images: parsedImages };
    }

    const note = await updateNote(id, updates);
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (err) {
    console.error("Failed to update note:", err);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidNoteId(id)) return invalidIdResponse();

  try {
    const body = await request.json();
    if (typeof body.title !== "string") {
      return NextResponse.json(
        { error: "title must be a string" },
        { status: 400 }
      );
    }

    const note = await updateNote(id, { title: body.title });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (err) {
    console.error("Failed to patch note:", err);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidNoteId(id)) return invalidIdResponse();

  try {
    const deleted = await deleteNote(id);
    if (!deleted) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete note:", err);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
