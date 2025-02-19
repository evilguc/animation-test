import { IRequest } from "itty-router";
import { SESSION_HISTORY_KV_KEY_PREFIX } from "../../common/constants";
import { createJsonResponse } from "../../common/utils/response";

export async function getCharacterSessionFromHistory(request: IRequest, env: Env) {
  const characterId = (request.params.characterId || "").trim();
  const sessionId = (request.params.sessionId || "").trim();

  if (characterId === "" || sessionId === "") {
    return createJsonResponse({ error: "Invalid character or session ID" }, 400);
  }

  const sessionKey = `${SESSION_HISTORY_KV_KEY_PREFIX}${characterId}/${sessionId}`;
  const sessionData = await env.SESSION_HISTORY.get(sessionKey);

  if (!sessionData) {
    return createJsonResponse({ error: "Session not found" }, 404);
  }

  return createJsonResponse(JSON.parse(sessionData), 200);
}
