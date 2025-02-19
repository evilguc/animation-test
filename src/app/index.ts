import { authenticateRequest, AuthenticationError } from "./utils/auth";
import { getCharacterOwner } from "./utils/character-ownership";

export async function handleSessionRequest(request: Request, env: Env) {
  try {
    const { userId } = await authenticateRequest(request, env);

    const url = new URL(request.url);
    const characterId = url.pathname.split("/session/")[1];

    if (characterId == null) {
      return new Response("Missing character ID", { status: 400 });
    }

    const characterOwnerId = await getCharacterOwner(env, characterId);

    if (characterOwnerId !== userId) {
      return new Response("Character not found or belongs to another user", { status: 403 });
    }

    const sessionDOId = env.SESSION_NAMESPACE.idFromName(characterId);
    const sessionDOInstance = env.SESSION_NAMESPACE.get(sessionDOId);

    const sessionRequest = new Request(`${request.url}?userId=${userId}&characterId=${characterId}`, request);

    return sessionDOInstance.fetch(sessionRequest);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return new Response(err.message, { status: 401 });
    }

    return new Response(`Error handling session request: ${err}`, { status: 500 });
  }
}
