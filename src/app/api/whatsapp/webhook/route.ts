import { after, NextResponse } from "next/server";
import { z } from "zod";
import { meteredChatReply } from "@/lib/ai/usage";
import { summarizeUserDay } from "@/lib/ai/summarize-day";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp/client";
import { handleInboundMessage, type InboundMessage, type WhatsAppDeps } from "@/lib/whatsapp/handlers";
import { verifyWebhookSignature } from "@/lib/whatsapp/signature";

/**
 * The WhatsApp Cloud API webhook (AGENTS.md §6, PRD.md §6).
 *
 * GET answers Meta's handshake when the webhook is registered. POST receives the
 * messages: the signature is checked against the **raw** body before anything is
 * parsed, an invalid one gets 401, and a valid one gets 200 at once while the
 * messages are processed after the response (Meta resends a webhook that is not
 * acknowledged quickly, and the resend is harmless because every message id is
 * stored once).
 *
 * Nothing here logs a message body, and the response never carries one.
 */

/** Seconds. Answering a message can take two model calls, so the default is too short. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return new NextResponse("WhatsApp belum dikonfigurasi.", { status: 503 });
  }

  const params = new URL(request.url).searchParams;

  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken) {
    // Meta expects the challenge back as it was sent, as plain text.
    return new NextResponse(params.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Tidak diizinkan.", { status: 403 });
}

const payloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z
                .object({
                  messages: z
                    .array(
                      z.object({
                        id: z.string().min(1),
                        from: z.string().regex(/^\d{8,15}$/),
                        type: z.string(),
                        text: z.object({ body: z.string() }).optional(),
                      }),
                    )
                    .optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

/** The messages in a payload; delivery receipts and anything else are left out. */
function messagesOf(payload: unknown): InboundMessage[] {
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return [];
  }

  return (parsed.data.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) =>
      (change.value?.messages ?? []).map((message) => ({
        id: message.id,
        from: message.from,
        type: message.type,
        text: message.type === "text" ? (message.text?.body ?? null) : null,
      })),
    ),
  );
}

function liveDeps(): WhatsAppDeps {
  const admin = createSupabaseAdminClient();

  return {
    admin,
    now: () => new Date(),
    send: sendTextMessage,
    chat: async (turns, userId) => {
      const result = await meteredChatReply(turns, userId);

      return { reply: result.reply, riskFlag: result.risk_flag };
    },
    summarize: (input) =>
      summarizeUserDay({
        reader: admin,
        userId: input.userId,
        timeZone: input.timeZone,
        plan: input.plan,
        date: input.date,
      }),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  };
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    return new NextResponse("WhatsApp belum dikonfigurasi.", { status: 503 });
  }

  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Tanda tangan tidak valid.", { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Signed but not JSON: nothing to do, and a retry would not help.
    return new NextResponse("ok", { status: 200 });
  }

  const messages = messagesOf(payload);

  if (messages.length > 0) {
    after(async () => {
      const deps = liveDeps();

      for (const message of messages) {
        try {
          await handleInboundMessage(deps, message);
        } catch (error) {
          // The message id and the class of the error are enough to investigate.
          console.error("whatsapp: handling a message failed", {
            messageId: message.id,
            kind: (error as Error).name,
          });
        }
      }
    });
  }

  return new NextResponse("ok", { status: 200 });
}
