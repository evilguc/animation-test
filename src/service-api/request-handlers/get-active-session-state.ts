import { IRequest } from "itty-router";
import { SESSION_SYSTEM_REQUEST_PATH_PREFIX } from "../../common/constants";
import { createJsonResponse } from "../../common/utils/response";

export async function getActiveSessionState(request: IRequest, env: Env) {
  const characterId = (request.params.characterId || "").trim();

  if (characterId === "") {
    return new Response("Invalid character ID", { status: 400 });
  }

  const sessionDOId = env.SESSION_NAMESPACE.idFromName(characterId);
  const sessionDO = env.SESSION_NAMESPACE.get(sessionDOId);

  const response = await sessionDO.fetch(new Request(`http://internal${SESSION_SYSTEM_REQUEST_PATH_PREFIX}state`));

  if (response.status === 200) {
    return createJsonResponse(await response.json(), 200);
  } else if (response.status === 404) {
    return createJsonResponse({ error: "No active session" }, 404);
  } else {
    return createJsonResponse({ error: "Unexpected error" }, 500);
  }
}
