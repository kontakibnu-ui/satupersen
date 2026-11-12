/**
 * The only place that talks to the WhatsApp Cloud API (AGENTS.md §4). It runs on
 * the server and never logs a message body. The version segment is the one the
 * Meta documentation uses in its own examples (checked 2026-10-29: the current
 * Graph API version is v26.0).
 */
const GRAPH_URL = "https://graph.facebook.com/v26.0";
const REQUEST_TIMEOUT_MS = 15_000;

/** Missing setup, not a failed request: the caller shows a configuration message. */
export class WhatsAppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppConfigError";
  }
}

export class WhatsAppSendError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "WhatsAppSendError";
    this.status = status;
  }
}

function credentials(): { token: string; phoneNumberId: string } {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneNumberId) {
    throw new WhatsAppConfigError("WhatsApp belum dikonfigurasi");
  }

  return { token, phoneNumberId };
}

/** True when everything needed to send and to receive is set (see .env.example). */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_APP_SECRET?.trim() &&
      process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
  );
}

async function graphRequest(path: string, init: RequestInit & { token: string }): Promise<unknown> {
  const { token, ...rest } = init;

  let response: Response;

  try {
    response = await fetch(`${GRAPH_URL}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...rest.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new WhatsAppSendError("WhatsApp tidak bisa dihubungi", null);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // The status is enough to act on; the body can echo the recipient or the text.
    throw new WhatsAppSendError(`WhatsApp menolak permintaan (${response.status})`, response.status);
  }

  return body;
}

/**
 * Sends a free-form text. WhatsApp only allows this inside the 24 hour window
 * after the user's last message (AGENTS.md §6); the caller checks that. Returns
 * the id WhatsApp gives the message.
 */
export async function sendTextMessage(to: string, body: string): Promise<string> {
  const { token, phoneNumberId } = credentials();

  const result = (await graphRequest(`/${phoneNumberId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  })) as { messages?: { id?: string }[] } | null;

  const id = result?.messages?.[0]?.id;

  if (!id) {
    throw new WhatsAppSendError("WhatsApp tidak mengembalikan id pesan", null);
  }

  return id;
}

let cachedDisplayNumber: { value: string; at: number } | null = null;
const DISPLAY_NUMBER_TTL_MS = 60 * 60 * 1000;

/**
 * The digits of the number users write to, for the wa.me link. It is read from
 * the phone number record, so no extra setting is needed; a short cache keeps
 * the settings page from asking Meta on every visit.
 */
export async function getBusinessPhoneDigits(): Promise<string> {
  if (cachedDisplayNumber && Date.now() - cachedDisplayNumber.at < DISPLAY_NUMBER_TTL_MS) {
    return cachedDisplayNumber.value;
  }

  const { token, phoneNumberId } = credentials();
  const result = (await graphRequest(`/${phoneNumberId}?fields=display_phone_number`, {
    method: "GET",
    token,
  })) as { display_phone_number?: string } | null;

  const digits = result?.display_phone_number?.replace(/\D/g, "") ?? "";

  if (digits === "") {
    throw new WhatsAppSendError("WhatsApp tidak mengembalikan nomor", null);
  }

  cachedDisplayNumber = { value: digits, at: Date.now() };
  return digits;
}
