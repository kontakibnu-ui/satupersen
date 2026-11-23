import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";
import { SHARE_IMAGE_COLOR as C } from "@/lib/theme";

// The picture shown when a link to Satu Persen is shared (Open Graph), in the
// day palette of DESIGN.md §3: paper, one ink, and the scribbled underline of
// §14.3 under "1% lebih baik", the same as the landing hero.
export const alt = "Satu Persen, jadi 1% lebih baik tiap hari";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: C.paper,
          color: C.text,
        }}
      >
        <div style={{ display: "flex", fontSize: 40, letterSpacing: "-0.02em" }}>{SITE_NAME}.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 84, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            <span>Jadi&nbsp;</span>
            <span style={{ position: "relative", display: "flex", color: C.ink }}>
              1% lebih baik
              <svg
                width="560"
                height="22"
                viewBox="0 0 100 9"
                preserveAspectRatio="none"
                style={{ position: "absolute", left: -6, bottom: -18 }}
              >
                <path d="M1 6C18 2 30 7.5 49 4.5S82 2.5 99 5.5" fill="none" stroke={C.ink} strokeWidth="0.9" strokeLinecap="round" />
              </svg>
            </span>
            <span>&nbsp;tiap hari</span>
          </div>
          <div style={{ display: "flex", maxWidth: 900, fontSize: 32, lineHeight: 1.4, color: C.muted }}>
            Tulis harimu beberapa kalimat. Lihat analisanya, dan seberapa jauh kamu sudah bergerak.
          </div>
        </div>

        {/* The double rule of §14.3, as two hairlines: the image renderer has no `double` border. */}
        <div
          style={{
            display: "flex",
            height: 4,
            width: "100%",
            borderTop: `1px solid ${C.rule}`,
            borderBottom: `1px solid ${C.rule}`,
          }}
        />
      </div>
    ),
    size,
  );
}
