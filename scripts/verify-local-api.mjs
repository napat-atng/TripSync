// Synthetic local users verify app/API/RLS plumbing, not Google's OAuth flow.
import { readFileSync, writeFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const config = JSON.parse(readFileSync(".supabase-status.log", "utf8").replace(/^\uFEFF/, ""));
assert.equal(config.API_URL, "http://127.0.0.1:54321", "This verifier must only target local Supabase");
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { db: { schema: "tripsync" }, auth: { persistSession: false, autoRefreshToken: false } });
if (process.argv.includes("--cleanup-fixtures")) {
  const fixture = JSON.parse(readFileSync(".supabase-browser-session.log", "utf8"));
  for (const id of fixture.userIds) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error) throw error;
    assert.match(data.user.email, /^web-test-.*@example\.invalid$/, "Only verifier-created accounts may be removed");
  }
  const { error } = await admin.from("trips").delete().in("owner_id", fixture.userIds);
  if (error) throw error;
  for (const id of fixture.userIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
  console.log("Removed only synthetic verifier accounts and their local rooms.");
  process.exit(0);
}
const ids = [];
let tripId;
const keep = process.argv.includes("--keep-fixtures");
function accessToken(user) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: "authenticated", aud: "authenticated", iss: `${config.API_URL}/auth/v1`, email: user.email, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}`;
  return `${unsigned}.${createHmac("sha256", config.JWT_SECRET).update(unsigned).digest("base64url")}`;
}
try {
  const users = [];
  for (const name of ["Browser verifier", "Unrelated verifier"]) {
    const { data, error } = await admin.auth.admin.createUser({ email: `web-test-${randomUUID()}@example.invalid`, email_confirm: true, user_metadata: { full_name: name }, app_metadata: { provider: "google", providers: ["google"] } });
    if (error) throw error;
    ids.push(data.user.id);
    users.push(data.user);
  }
  const tokens = users.map(accessToken);
  const clients = tokens.map(token => createClient(config.API_URL, config.ANON_KEY, { db: { schema: "tripsync" }, accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false } }));
  const created = await clients[0].rpc("create_trip", { p_name: "ทริปทดสอบชื่อยาวสำหรับตรวจหน้าจอที่มือถือและคอมพิวเตอร์", p_description: "ข้อมูลนี้เป็น fixture สำหรับทดสอบ local เท่านั้น" });
  if (created.error) throw created.error;
  tripId = created.data;
  const ownTrips = await clients[0].from("trips").select("*").eq("id", tripId);
  assert.equal(ownTrips.error, null); assert.equal(ownTrips.data.length, 1);
  const otherTrips = await clients[1].from("trips").select("*").eq("id", tripId);
  assert.equal(otherTrips.error, null); assert.equal(otherTrips.data.length, 0);
  const forbidden = await clients[1].from("trip_members").insert({ trip_id: tripId, user_id: users[1].id });
  assert.equal(forbidden.error?.code, "42501");
  const edited = await clients[0].from("profiles").update({ display_name: "Browser verifier edited" }).eq("id", users[0].id).select("display_name").single();
  assert.equal(edited.error, null); assert.equal(edited.data.display_name, "Browser verifier edited");
  console.log("PASS: local API room creation, persistence, profile editing, cross-room RLS, and forged-membership rejection.");
  if (keep) {
    writeFileSync(".supabase-browser-session.log", JSON.stringify({ session: { access_token: tokens[0], refresh_token: "synthetic-local-fixture", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: users[0] }, tripId, userIds: ids }));
    console.log("Retained synthetic local fixtures for browser verification; reset local DB to remove them.");
  }
} finally {
  if (!keep) {
    if (tripId) { const { error } = await admin.from("trips").delete().eq("id", tripId); if (error) throw error; }
    for (const id of ids) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw error; }
  }
}
