import { v7 as uuidv7 } from "uuid";
import { CommandName } from "./command-processor";
import { SESSION_HISTORY_KV_KEY_PREFIX } from "../../common/constants";

const METADATA_KEY = "sessionMetadata";
const SESSION_END_REASONS = ["timeout", "user_closed"] as const;
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];

type Metadata = {
  sessionId: string;
  characterId: string;
  userId: string;
  startTime: Date;
  endTime: Date | null;
  endReason: SessionEndReason | null;
  commands: { command: CommandName; args: any; date: Date }[];
};

export class SessionMetadata {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async initialize(characterId: string, userId: string) {
    const sessionId = uuidv7();

    await this.state.storage.put(METADATA_KEY, {
      sessionId,
      characterId,
      userId,
      startTime: new Date(),
      endTime: null,
      endReason: null,
      commands: [],
    } satisfies Metadata);

    return sessionId;
  }

  async getMetadata() {
    const value = await this.state.storage.get(METADATA_KEY);

    if (value == null) {
      throw new Error("Session metadata not found");
    }

    return value as Metadata;
  }

  async endSession(endReason: SessionEndReason) {
    const finalMetadata = await this.updateMetadata({
      endTime: new Date(),
      endReason,
    });

    await this.flushToHistory(finalMetadata);

    return finalMetadata;
  }

  async addCommand(command: CommandName, args: any) {
    const metadata = await this.getMetadata();
    const date = new Date();

    metadata.commands.push({ command, args, date });

    await this.updateMetadata({ commands: metadata.commands });
  }

  private async updateMetadata(updates: Partial<Metadata>) {
    console.log("Updating metadata with", updates);
    const metadata = (await this.state.storage.get(METADATA_KEY)) || {};
    Object.assign(metadata, updates);
    await this.state.storage.put(METADATA_KEY, metadata);
    return metadata as Metadata;
  }

  private async flushToHistory(metadata: Metadata) {
    const historyKey = `${SESSION_HISTORY_KV_KEY_PREFIX}${metadata.characterId}/${metadata.sessionId}`;
    await this.env.SESSION_HISTORY.put(historyKey, JSON.stringify(metadata));
  }
}
