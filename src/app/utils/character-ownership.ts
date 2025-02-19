export async function getCharacterOwner(env: Env, characterId: string): Promise<string | null> {
  return await env.CHARACTER_OWNERSHIP.get(characterId);
}
