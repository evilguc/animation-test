import { IRequest } from "itty-router";
import { SESSION_HISTORY_KV_KEY_PREFIX } from "../../common/constants";
import { createJsonResponse } from "../../common/utils/response";

const KV_GET_BATCH_SIZE = 100;

/**
 * Let's do not rely on session metadata for command order.
 * Anyway, this implementation is very naive and not production-ready for several reasons:
 *   - It does not paginate or limit the number of commands returned.
 *   - It does not handle errors or edge cases.
 *   - It's not clear "why" we need to list all commands for a character.
 */
export async function listCommandsForCharacter(request: IRequest, env: Env) {
  const characterId = (request.params.characterId || "").trim();

  if (characterId === "") {
    return createJsonResponse({ error: "Invalid character ID" }, 400);
  }

  const sessionHistoryCharacterPrefix = `${SESSION_HISTORY_KV_KEY_PREFIX}${characterId}/`;

  const sessionHistoryKeys = await env.SESSION_HISTORY.list({ prefix: sessionHistoryCharacterPrefix });

  const allCommands = [];
  let errorsOccurred = false;

  for (let i = 0; i < sessionHistoryKeys.keys.length; i += KV_GET_BATCH_SIZE) {
    const batch = sessionHistoryKeys.keys.slice(i, i + KV_GET_BATCH_SIZE);

    const results = await Promise.allSettled(batch.map((key) => env.SESSION_HISTORY.get(key.name)));

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        try {
          const parsedData = JSON.parse(result.value);

          if (Array.isArray(parsedData.commands)) {
            allCommands.push(...parsedData.commands);
          } else {
            console.warn(`⚠️ Invalid commands format in session metadata: expected array, got ${typeof parsedData.commands}`);
            errorsOccurred = true;
          }
        } catch (err) {
          console.warn("⚠️ Failed to parse session metadata:", err);
          errorsOccurred = true;
        }
      } else {
        console.warn("⚠️ Failed to fetch session data from KV:", result);
        errorsOccurred = true;
      }
    }
  }

  // Sort commands by timestamp (oldest to newest)
  allCommands.sort((a, b) => a.timestamp - b.timestamp);

  return createJsonResponse({ commands: allCommands, errorsOccurred }, 200);
}
