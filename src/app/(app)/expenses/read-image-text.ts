/**
 * Reads the text of a screenshot on the phone (PRD.md EXP-7), so the picture
 * itself is never uploaded. tesseract.js runs in a web worker; its engine and the
 * Indonesian language data are served from /ocr on this site
 * (scripts/copy-ocr-assets.mjs), because the Content-Security-Policy allows no
 * other origin. The library is loaded only when a picture is chosen, so the Uang
 * screen does not carry it otherwise. The language data is about 1 MB and the
 * engine about 4 MB, both cached by the browser after the first read.
 */

export type ReadStage = "preparing" | "reading";

export async function readImageText(
  image: Blob,
  onProgress: (stage: ReadStage, fraction: number) => void,
): Promise<string> {
  const tesseract = await import("tesseract.js");

  onProgress("preparing", 0);

  const worker = await tesseract.createWorker("ind", tesseract.OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    // A worker from this origin, not a blob: URL, so the CSP needs no blob: source.
    workerBlobURL: false,
    logger: (message) => {
      onProgress(message.status === "recognizing text" ? "reading" : "preparing", message.progress);
    },
  });

  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
