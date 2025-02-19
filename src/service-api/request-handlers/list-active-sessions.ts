import { ACTIVE_SESSIONS_KV_KEY_PREFIX } from "../../common/constants";

export async function listActiveSessions(request: Request, env: Env) {
  const activeSessionKeys = await env.ACTIVE_SESSIONS.list({ prefix: ACTIVE_SESSIONS_KV_KEY_PREFIX });

  const activeSessions = activeSessionKeys.keys.map((key) => {
    const valuePart = key.name.replace(ACTIVE_SESSIONS_KV_KEY_PREFIX, "");
    const [characterId, userId] = valuePart.split(":");
    return { characterId, userId };
  });

  return new Response(JSON.stringify(activeSessions), { status: 200 });
}
