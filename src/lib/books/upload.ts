/**
 * Puts a book file into Supabase Storage with the one-time permission from
 * startBookUpload (PRD.md READ-2). Browser only.
 *
 * It calls the same endpoint as supabase-js's `uploadToSignedUrl`
 * (PUT /storage/v1/object/upload/sign/<bucket>/<path>?token=…), but through
 * XMLHttpRequest, because fetch cannot report upload progress and the screen
 * shows the real percentage (DESIGN.md §6 "Lembaran Ruang baca").
 */
export function uploadBookFile(input: {
  path: string;
  token: string;
  file: Blob;
  contentType: string;
  onProgress: (percent: number) => void;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return Promise.reject(new Error("Supabase is not configured in the browser"));
  }

  const target = `${url}/storage/v1/object/upload/sign/books/${input.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?token=${encodeURIComponent(input.token)}`;

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target);
    request.setRequestHeader("apikey", anonKey);
    request.setRequestHeader("content-type", input.contentType);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("cache-control", "max-age=3600");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        input.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage answered ${request.status}`));
      }
    };
    request.onerror = () => reject(new Error("The upload could not reach Storage"));
    request.onabort = () => reject(new Error("The upload was stopped"));

    request.send(input.file);
  });
}
