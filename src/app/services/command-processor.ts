const RATE_LIMIT = 5;
const RATE_LIMIT_PERIOD_MS = 1000;

const KNOWN_COMMANDS = ["start", "stop", "rotate", "move", "reset"] as const;
export type CommandName = (typeof KNOWN_COMMANDS)[number];

const ERROR_CODES = ["INVALID_FORMAT", "UNKNOWN_COMMAND", "UNKNOWN_ERROR"] as const;
export type CommandProcessorErrorCode = (typeof ERROR_CODES)[number];

export class CommandProcessorError extends Error {
  constructor(
    public code: CommandProcessorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommandProcessorError";
  }
}

export class CommandProcessor {
  private messageCounts: Record<string, number> = {};

  enforceRateLimit(sessionId: string) {
    const currentCount = this.messageCounts[sessionId] || 0;

    if (currentCount >= RATE_LIMIT) {
      return false;
    }

    this.messageCounts[sessionId] = currentCount + 1;

    setTimeout(() => {
      this.messageCounts[sessionId]--;
    }, RATE_LIMIT_PERIOD_MS);

    return true;
  }

  parseCommand(data: unknown): { command: CommandName; args: any } {
    try {
      if (typeof data !== "object") {
        throw new CommandProcessorError("INVALID_FORMAT", "Invalid command format.");
      }

      const unknownCommand = data as { command: unknown; args: unknown };

      if (typeof unknownCommand.command !== "string") {
        throw new CommandProcessorError("INVALID_FORMAT", "Invalid command format.");
      }

      const castedCommand: CommandName = unknownCommand.command as CommandName;

      if (!KNOWN_COMMANDS.includes(castedCommand)) {
        throw new CommandProcessorError("UNKNOWN_COMMAND", `Unknown command: ${castedCommand}`);
      }

      return { command: castedCommand, args: unknownCommand.args || {} };
    } catch (err) {
      if (err instanceof CommandProcessorError) {
        throw err;
      }

      throw new CommandProcessorError("UNKNOWN_ERROR", (err as Error).message || "Unknown error");
    }
  }

  async processCommand(command: CommandName, args: any) {
    // It's a placeholder
    console.log(`Processing command: ${command} with args`, args);
  }
}
