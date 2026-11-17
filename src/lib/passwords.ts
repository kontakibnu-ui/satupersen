/**
 * The shortest new password the forms accept (AUTH-1, AUTH-5): signing up and
 * setting a new password after a reset. Signing in accepts whatever the account
 * already has. Supabase Auth applies its own rules on the server as well.
 */
export const MIN_NEW_PASSWORD = 8;
