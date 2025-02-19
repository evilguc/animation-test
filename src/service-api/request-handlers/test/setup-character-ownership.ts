import { IRequest } from "itty-router";
import { createJsonResponse } from "../../../common/utils/response";

/**
 * Stupid and pretty dangerous endpoint to setup character ownership for testing purposes.
 */
export async function setupCharacterOwnership(request: IRequest, env: Env) {
  const entries = (await request.json()) as { userId: string; characterId: string }[];

  for (const { userId, characterId } of entries) {
    if (userId == null || characterId == null) {
      continue;
    }

    await env.CHARACTER_OWNERSHIP.put(characterId, userId);
  }

  return createJsonResponse({ message: "Character ownership records created" }, 201);
}
