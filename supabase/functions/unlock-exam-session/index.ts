// Exam face+liveness gate. Identity is verified server-side against the stored embedding;
// liveness (blink detection) is asserted by the client, which is a documented limitation —
// see the "Documented assumptions" section of the migration plan. Three failed attempts
// (identity or liveness) flip the session to pending_manual_review for admin approval.
import { createClient } from "jsr:@supabase/supabase-js@2";

const IDENTITY_THRESHOLD = 0.5;
const MAX_ATTEMPTS = 3;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 128 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Caller-scoped client: respects RLS, used for everything except the embedding distance calc.
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: { session_id?: unknown; embedding?: unknown; liveness_passed?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_embedding", detail: "malformed JSON body" }, 400);
  }
  if (typeof body.session_id !== "string") {
    return jsonResponse({ error: "invalid_session" }, 400);
  }
  if (!isValidEmbedding(body.embedding)) {
    return jsonResponse({ error: "invalid_embedding", detail: "embedding must be an array of 128 finite numbers" }, 400);
  }
  const livenessPassed = body.liveness_passed === true;
  const sessionId = body.session_id;

  const { data: session, error: sessionError } = await callerClient
    .from("exam_sessions")
    .select("id, user_id, status, face_gate_attempts")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return jsonResponse({ error: "internal_error", detail: sessionError.message }, 500);
  if (!session || session.user_id !== userId) return jsonResponse({ error: "invalid_session" }, 400);
  if (!["face_gate_pending", "pending_manual_review"].includes(session.status)) {
    return jsonResponse({ error: "invalid_session", detail: `session status is ${session.status}` }, 400);
  }

  // service_role only for the distance RPC — never exposed to the client directly.
  const serviceClient = createClient(url, serviceKey);
  const { data: rows, error: rpcError } = await serviceClient.rpc("face_distance", {
    p_user_id: userId,
    p_embedding: body.embedding,
  });
  if (rpcError) return jsonResponse({ error: "internal_error", detail: rpcError.message }, 500);
  if (!rows || rows.length === 0) return jsonResponse({ error: "no_enrollment" }, 404);

  const distance = rows[0].distance as number;
  const identityPassed = distance <= IDENTITY_THRESHOLD;
  const unlocked = identityPassed && livenessPassed;

  await callerClient.from("face_gate_attempts").insert({
    session_id: sessionId,
    user_id: userId,
    distance,
    liveness_passed: livenessPassed,
    identity_passed: identityPassed,
  });

  if (unlocked) {
    await callerClient
      .from("exam_sessions")
      .update({
        status: "in_progress",
        face_gate_passed_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        current_round: "technical",
      })
      .eq("id", sessionId);
    return jsonResponse({ unlocked: true });
  }

  const attempts = session.face_gate_attempts + 1;
  const reason = !identityPassed ? "identity" : "liveness";

  if (attempts >= MAX_ATTEMPTS) {
    await callerClient
      .from("exam_sessions")
      .update({ status: "pending_manual_review", face_gate_attempts: attempts })
      .eq("id", sessionId);
    return jsonResponse({ unlocked: false, reason: "max_attempts", status: "pending_manual_review" });
  }

  await callerClient
    .from("exam_sessions")
    .update({ face_gate_attempts: attempts })
    .eq("id", sessionId);
  return jsonResponse({ unlocked: false, reason, attempts_remaining: MAX_ATTEMPTS - attempts });
});
