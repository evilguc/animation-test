import { IRequest } from "itty-router";
import { SESSION_HISTORY_KV_KEY_PREFIX } from "../../common/constants";
import { createJsonResponse } from "../../common/utils/response";
import { extractTimestampFromUUIDv7 } from "../../common/utils/uuid";

export async function listCharacterSessions(request: IRequest, env: Env) {
  const characterId = (request.params.characterId || "").trim();

  if (characterId === "") {
    return createJsonResponse({ error: "Invalid character ID" }, 400);
  }

  const sessionHistoryCharacterPrefix = `${SESSION_HISTORY_KV_KEY_PREFIX}${characterId}/`;
  const sessionHistoryKeys = await env.SESSION_HISTORY.list({ prefix: sessionHistoryCharacterPrefix });

  const sortedSessions = sessionHistoryKeys.keys
    .map((key) => {
      const sessionId = key.name.replace(sessionHistoryCharacterPrefix, "");
      const timestamp = extractTimestampFromUUIDv7(sessionId);
      return { date: new Date(timestamp), sessionId };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return createJsonResponse(sortedSessions, 200);
}
