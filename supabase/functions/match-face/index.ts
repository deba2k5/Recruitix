// Identity-only distance check. Resolves the caller's own user id from their JWT — no
// client-supplied user id is ever accepted, so there is no cross-user probing surface.
// Used directly by the exam gate's identity step and by continuous proctoring re-verification.
import { createClient } from "jsr:@supabase/supabase-js@2";

const THRESHOLD = 0.5; // Euclidean "same person" cutoff for face-api.js's 128-d descriptors.

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
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await anonClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: { embedding?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_embedding", detail: "malformed JSON body" }, 400);
  }
  if (!isValidEmbedding(body.embedding)) {
    return jsonResponse({ error: "invalid_embedding", detail: "embedding must be an array of 128 finite numbers" }, 400);
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error: rpcError } = await serviceClient.rpc("face_distance", {
    p_user_id: userId,
    p_embedding: body.embedding,
  });
  if (rpcError) return jsonResponse({ error: "internal_error", detail: rpcError.message }, 500);
  if (!rows || rows.length === 0) return jsonResponse({ error: "no_enrollment" }, 404);

  const distance = rows[0].distance as number;
  return jsonResponse({ match: distance <= THRESHOLD, distance, threshold: THRESHOLD });
});
