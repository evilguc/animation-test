import { Router } from "itty-router";
import { authenticateRequest, AuthenticationError } from "./utils/auth";
import { listActiveSessions } from "./request-handlers/list-active-sessions";
import { getActiveSessionState } from "./request-handlers/get-active-session-state";
import { listCharacterSessions } from "./request-handlers/list-character-sessions";
import { getCharacterSessionFromHistory } from "./request-handlers/get-character-session-from-history";
import { listCommandsForCharacter } from "./request-handlers/list-commands-for-character";
import { setupCharacterOwnership } from "./request-handlers/test/setup-character-ownership";
import { createJsonResponse } from "../common/utils/response";

const router = Router();

router.get("/sessions/active", listActiveSessions);
router.get("/sessions/history/:characterId", listCharacterSessions);
router.get("/session/history/:characterId/:sessionId", getCharacterSessionFromHistory);
router.get("/session/:characterId/active", getActiveSessionState);
router.get("/character/commands/:characterId", listCommandsForCharacter);

// TODO: Remove this endpoint before production
router.post("/test/setup-character-ownership", setupCharacterOwnership);

export async function handleServiceApiRequest(request: Request, env: Env) {
  try {
    await authenticateRequest(request, env);

    return await router.fetch(request, env);
  } catch (err) {
    console.error(err);

    if (err instanceof AuthenticationError) {
      return createJsonResponse({ error: err.message }, 401);
    }

    return createJsonResponse({ error: "Unexpected error" }, 500);
  }
}
