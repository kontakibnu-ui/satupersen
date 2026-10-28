/**
 * Rules about a diary entry that both the editor and the server action need.
 *
 * It lives here rather than in the "use server" file because those files may
 * only export async functions; exporting a constant from one makes the whole
 * module export nothing, which the build refuses.
 */
export const MAX_CONTENT_LENGTH = 5000;
