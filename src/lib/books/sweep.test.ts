import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOKS_BUCKET, orphanCandidates, sweepOrphanBookFiles } from "./sweep";

/**
 * The sweep of book files whose owner is gone. The pure part always runs; the
 * part against Storage needs LOCAL_SUPABASE_URL and LOCAL_SUPABASE_SERVICE_KEY,
 * like the other database tests, and skips itself without the local stack.
 */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("orphanCandidates", () => {
  it("hanya folder bernama id user yang tidak punya profil", () => {
    expect(orphanCandidates([A, B], new Set([A]))).toEqual([B]);
  });

  it("folder yang bukan id user tidak pernah disentuh", () => {
    expect(orphanCandidates(["reader-cache", "../etc", "", `${A}x`], new Set())).toEqual([]);
  });

  it("semua punya profil berarti tidak ada yang dibersihkan", () => {
    expect(orphanCandidates([A, B], new Set([A, B]))).toEqual([]);
  });
});

const url = process.env.LOCAL_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;

async function isReachable(): Promise<boolean> {
  if (!url || !serviceKey) {
    return false;
  }

  try {
    return (await fetch(`${url}/auth/v1/health`, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    // Unreachable means the stack is off; the database part skips itself.
    return false;
  }
}

const stackIsUp = await isReachable();

describe.skipIf(!stackIsUp)("pembersihan file buku dengan Storage sungguhan", () => {
  let admin: SupabaseClient;
  const users: string[] = [];

  async function makeUserWithFile(label: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
      email: `sapu-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "RahasiaUji123!",
      email_confirm: true,
    });

    if (error || !data.user) {
      throw new Error(`Gagal membuat user uji: ${error?.message}`);
    }

    users.push(data.user.id);
    const { error: uploadError } = await admin.storage
      .from(BOOKS_BUCKET)
      .upload(`${data.user.id}/buku.txt`, new Blob(["isi buku uji"], { type: "text/plain" }), {
        contentType: "text/plain",
      });

    if (uploadError) {
      throw new Error(`Gagal mengunggah file uji: ${uploadError.message}`);
    }

    return data.user.id;
  }

  const filesOf = async (userId: string) => (await admin.storage.from(BOOKS_BUCKET).list(userId)).data ?? [];

  beforeAll(() => {
    admin = createClient(url as string, serviceKey as string, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    for (const id of users) {
      await admin.storage.from(BOOKS_BUCKET).remove([`${id}/buku.txt`]);
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("akun yang dihapus di luar aplikasi: filenya dibersihkan, file akun lain tetap ada", async () => {
    const gone = await makeUserWithFile("hilang");
    const kept = await makeUserWithFile("tetap");

    // Deleted the way the Supabase dashboard does it: rows cascade, files stay.
    const { error } = await admin.auth.admin.deleteUser(gone);
    expect(error).toBeNull();
    expect(await filesOf(gone)).toHaveLength(1);

    const result = await sweepOrphanBookFiles(admin);

    expect(result.failed).toBe(false);
    expect(result.emptied).toBeGreaterThanOrEqual(1);
    expect(await filesOf(gone)).toEqual([]);
    expect((await filesOf(kept)).map((file) => file.name)).toEqual(["buku.txt"]);

    // Running again finds nothing more to do.
    const again = await sweepOrphanBookFiles(admin);
    expect(again.failed).toBe(false);
    expect(await filesOf(kept)).toHaveLength(1);
  });
});
