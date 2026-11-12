"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionContext } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getBusinessPhoneDigits,
  isWhatsAppConfigured,
  WhatsAppConfigError,
} from "@/lib/whatsapp/client";

/**
 * Linking a number (PRD.md §6). The user ticks the consent, the server makes a
 * code that lasts 15 minutes, and the number is only linked when WhatsApp
 * delivers `LINK KODE` from it, so a number can never be claimed by typing it
 * into a form. The code table is written with the service role only.
 */

export type LinkCodeResult =
  | { ok: true; code: string; expiresAt: string; businessPhone: string }
  | { ok: false; message: string };

export type OptInResult = { ok: true } | { ok: false; message: string };

const CODE_LIFETIME_MS = 15 * 60 * 1000;

/** No 0, O, 1, I, or L: a code is read off a screen and typed into a chat. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

const consentSchema = z.object({ consent: z.literal(true) });

export async function createLinkCode(input: { consent: boolean }): Promise<LinkCodeResult> {
  if (!consentSchema.safeParse(input).success) {
    return { ok: false, message: "Centang persetujuannya dulu untuk membuat kode." };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  if (!isWhatsAppConfigured()) {
    return { ok: false, message: "WhatsApp belum dikonfigurasi. Hubungi pengelola aplikasi." };
  }

  let businessPhone: string;

  try {
    businessPhone = await getBusinessPhoneDigits();
  } catch (error) {
    console.error("whatsapp: reading the business number failed", {
      kind: (error as Error).name,
      configured: !(error instanceof WhatsAppConfigError),
    });

    return { ok: false, message: "Nomor WhatsApp Satu Persen belum bisa dibaca. Coba lagi sebentar lagi." };
  }

  const admin = createSupabaseAdminClient();

  // One code at a time: a new one replaces any earlier code of this user.
  await admin.from("whatsapp_link_codes").delete().eq("user_id", context.userId);

  const expiresAt = new Date(Date.now() + CODE_LIFETIME_MS).toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    const { error } = await admin
      .from("whatsapp_link_codes")
      .insert({ code, user_id: context.userId, expires_at: expiresAt });

    if (!error) {
      return { ok: true, code, expiresAt, businessPhone };
    }
  }

  return { ok: false, message: "Kode belum bisa dibuat. Coba lagi sebentar lagi." };
}

/** The user may switch automatic replies on or off from here as well as with BERHENTI and MULAI. */
export async function setAutoReplies(optedIn: boolean): Promise<OptInResult> {
  if (typeof optedIn !== "boolean") {
    return { ok: false, message: "Pilihannya belum bisa disimpan." };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  const { data, error } = await context.supabase
    .from("whatsapp_links")
    .update({ opted_in: optedIn })
    .eq("user_id", context.userId)
    .select("user_id");

  if (error || !data || data.length === 0) {
    return { ok: false, message: "Pilihannya belum tersimpan. Coba lagi sebentar lagi." };
  }

  revalidatePath("/settings/whatsapp");
  return { ok: true };
}
