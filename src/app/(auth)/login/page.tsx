import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk · Satu Persen",
};

/**
 * One screen, one focus (DESIGN.md §2): the way in. Nothing else is competing
 * for attention, and there is a single primary button.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col justify-center px-4 py-12">
      <h1 className="font-serif text-title text-text">Masuk ke Satu Persen</h1>
      <p className="mt-2 text-base text-text-muted">
        Masuk dulu supaya catatanmu tersimpan di akunmu sendiri.
      </p>

      <LoginForm failed={status === "gagal"} />
    </main>
  );
}
