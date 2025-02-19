import { ACTIVE_SESSIONS_KV_KEY_PREFIX } from "../../common/constants";

export class ActiveSessionTracker {
  private lastActivity = 0;
  private readonly TOUCH_THRESHOLD_MS = 15_000;
  private readonly EXPIRATION_TTL_SEC = 60;

  constructor(private readonly env: Env) {}

  getLastActivity() {
    return this.lastActivity;
  }

  async touch(characterId: string, userId: string) {
    const now = Date.now();
    const timeElapsed = now - this.lastActivity;

    this.lastActivity = now;

    if (timeElapsed < this.TOUCH_THRESHOLD_MS) {
      return;
    }
    await this.env.ACTIVE_SESSIONS.put(this.buildKey(characterId, userId), "", { expirationTtl: this.EXPIRATION_TTL_SEC });
  }

  async close(characterId: string, userId: string) {
    await this.env.ACTIVE_SESSIONS.delete(this.buildKey(characterId, userId));
  }

  private buildKey(characterId: string, userId: string) {
    return `${ACTIVE_SESSIONS_KV_KEY_PREFIX}${characterId}:${userId}`;
  }
}
