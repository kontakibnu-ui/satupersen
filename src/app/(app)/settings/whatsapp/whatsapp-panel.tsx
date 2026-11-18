"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createLinkCode, setAutoReplies, type LinkCodeResult } from "./actions";

type Linked = { lastDigits: string; optedIn: boolean };

/**
 * One screen, two states. Not linked: the consent, then "Buat kode", then the
 * code with a button that opens WhatsApp with `LINK KODE` already typed. Linked:
 * which number, and whether automatic replies are on. "Buat kode" is the one
 * primary button until a code exists; then opening WhatsApp takes that place
 * (DESIGN.md §2).
 */
export function WhatsAppPanel({ linked }: { linked: Linked | null }) {
  return linked ? <LinkedView linked={linked} /> : <LinkView />;
}

function LinkView() {
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<LinkCodeResult | null>(null);
  const [pending, setPending] = useState(false);

  async function make() {
    setPending(true);
    setResult(await createLinkCode({ consent }));
    setPending(false);
  }

  const code = result?.ok ? result : null;

  return (
    <section aria-labelledby="link-title" className="mt-6 rounded-[14px] border border-border bg-surface p-[18px] md:p-6">
      <h2 id="link-title" className="font-heading text-base font-bold text-text">
        Hubungkan nomor
      </h2>
      {code ? (
        <>
          <p className="mt-3 text-sm text-text-muted">Kodemu, berlaku 15 menit</p>
          <p
            aria-label={`Kode ${code.code.split("").join(" ")}`}
            className="font-heading text-[36px] leading-[1.15] font-bold tracking-widest text-primary tabular-nums"
          >
            {code.code}
          </p>
          <p className="mt-3 text-base text-text">
            Tekan tombol di bawah, lalu kirim pesan yang sudah terisi (<span className="whitespace-nowrap">LINK {code.code}</span>)
            tanpa mengubahnya. Nomor yang mengirimnya yang akan terhubung.
          </p>
          <a
            href={`https://wa.me/${code.businessPhone}?text=${encodeURIComponent(`LINK ${code.code}`)}`}
            className={buttonVariants({ variant: "primary", className: "mt-[18px] w-full" })}
            rel="noreferrer noopener"
            target="_blank"
          >
            Buka WhatsApp
          </a>
        </>
      ) : (
        <>
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 size-6 shrink-0 rounded-sm border border-control accent-primary"
            />
            <span>
              Saya paham pesan WhatsApp saya diproses lewat server Meta, dan saya tidak akan mengirim
              data yang sangat sensitif seperti password atau nomor kartu.
            </span>
          </label>

          <Button onClick={() => void make()} disabled={pending} className="mt-[18px] w-full">
            {pending ? "Membuat kode…" : "Buat kode"}
          </Button>
        </>
      )}

      <p role="status" className="mt-2 text-sm text-text-muted">
        {result && !result.ok ? result.message : ""}
      </p>
    </section>
  );
}

function LinkedView({ linked }: { linked: Linked }) {
  const [optedIn, setOptedIn] = useState(linked.optedIn);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function change(next: boolean) {
    setOptedIn(next);
    setMessage(undefined);

    const result = await setAutoReplies(next);

    if (!result.ok) {
      setOptedIn(!next);
      setMessage(result.message);
    }
  }

  return (
    <section aria-label="Nomor terhubung" className="mt-6 rounded-[14px] border border-border bg-surface p-[18px] md:p-6">
      <p className="text-base text-text">
        Terhubung ke nomor berakhiran <span className="font-bold tabular-nums">{linked.lastDigits}</span>.
      </p>

      {/* A switch (DESIGN.md §14 wireframe) built on a native checkbox, so the browser keeps its state and keys. */}
      <label className="mt-2 flex min-h-14 cursor-pointer items-center justify-between gap-4 border-t border-rule py-2 text-base text-text">
        <span>Balas ceritaku secara otomatis</span>
        <span className="relative inline-flex h-[30px] w-[52px] shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={optedIn}
            onChange={(event) => void change(event.target.checked)}
            className="peer absolute inset-0 cursor-pointer appearance-none rounded-full border border-control bg-surface-muted transition-colors duration-200 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 left-1 size-[22px] rounded-full bg-control transition-transform duration-200 peer-checked:translate-x-[22px] peer-checked:bg-surface"
          />
        </span>
      </label>

      <p role="status" className="mt-2 text-sm text-text-muted">
        {message}
      </p>

      <p className="mt-4 text-sm text-text-muted">
        Di chat, ketik SELESAI untuk menganalisa hari ini, BERHENTI atau MULAI untuk mengatur balasan, dan
        BANTUAN untuk daftar perintah.
      </p>
    </section>
  );
}
