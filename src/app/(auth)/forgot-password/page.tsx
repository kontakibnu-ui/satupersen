import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Lupa password · Satu Persen",
};

/** One screen, one focus (DESIGN.md §2): ask for the reset link (AUTH-5). */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Lupa password"
      description="Tulis email akunmu. Kami kirim tautan untuk membuat password baru."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
