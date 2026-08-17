import { NextResponse } from "next/server";
import { sendFormEmail, type FormSubmission } from "@/lib/email/sendFormEmail";
import { makeReferenceId } from "@/lib/forms/referenceId";

// nodemailer needs the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Submissions carry text plus base64-encoded document attachments. Base64
// inflates bytes by ~33%, so allow headroom above the 20 MB client-side cap on
// combined upload size.
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB

export async function POST(req: Request) {
  try {
    // Basic payload-size guard.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }
    const rawBody = await req.text();
    if (rawBody.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }

    let body: FormSubmission & { honeypot?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    // Honeypot — a filled hidden field means a bot. Report success so the bot
    // doesn't learn it was blocked; no email is sent.
    if (typeof body.honeypot === "string" && body.honeypot.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    // Server-side validation — never trust the client alone.
    if (!body || typeof body.formName !== "string" || !body.formName.trim() || !Array.isArray(body.sections)) {
      return NextResponse.json({ ok: false, error: "Invalid submission." }, { status: 400 });
    }

    // Stamp a unique reference ID (used on the PDF record and shown to the user).
    const submittedAt = body.submittedAt ? new Date(body.submittedAt) : new Date();
    const referenceId = makeReferenceId(body.formName, submittedAt);

    await sendFormEmail({ ...body, referenceId });
    return NextResponse.json({ ok: true, referenceId });
  } catch (err) {
    console.error("[api/forms/submit] send failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to send submission." }, { status: 500 });
  }
}
