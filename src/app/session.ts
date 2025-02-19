import { DurableObject } from "cloudflare:workers";
import { ActiveSessionTracker } from "./services/active-session-tracker";
import { SessionEndReason, SessionMetadata } from "./services/session-metadata";
import { CommandProcessor } from "./services/command-processor";
import { SESSION_SYSTEM_REQUEST_PATH_PREFIX } from "../common/constants";
import { setTimeout as sleep } from "timers/promises";

const SESSION_ERROR_MESSAGES = [
  "Internal error",
  "Expected WebSocket connection",
  "Character is already in use by another session.",

  // system
  "Unexpected error",
  "No active session",
] as const;
type SessionErrorMessage = (typeof SESSION_ERROR_MESSAGES)[number];

const SESSION_AUTO_RELEASE_TIMEOUT_MS = 60_000;
const SESSION_SELF_MONITORING_INTERVAL_MS = 1_000;

const WEBSOCKET_INCOMING_MESSAGE_TYPES = ["command", "ping"] as const;
type WebSocketIncomingMessageType = (typeof WEBSOCKET_INCOMING_MESSAGE_TYPES)[number];

const WEBSOCKET_OUTGOING_MESSAGE_TYPES = ["pong", "error", "success", "session-end"] as const;
type WebSocketOutgoingMessageType = (typeof WEBSOCKET_OUTGOING_MESSAGE_TYPES)[number];

export class AnimationSessionDO extends DurableObject {
  private characterId: string | null = null;
  private userId: string | null = null;
  private sessionId: string | null = null;
  private sessionSelfMonitoringInterval: NodeJS.Timeout | null = null;
  private clientWebSocket: WebSocket | null = null;

  private readonly metadata: SessionMetadata;
  private readonly commandProcessor: CommandProcessor;
  private readonly activeSessionTracker: ActiveSessionTracker;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    this.metadata = new SessionMetadata(state, env);
    this.commandProcessor = new CommandProcessor();
    this.activeSessionTracker = new ActiveSessionTracker(env);
  }

  async fetch(request: Request) {
    if (this.isSystemRequest(request)) {
      return this.handleSystemRequest(request);
    } else {
      return this.handleUserRequest(request);
    }
  }

  private async handleUserRequest(request: Request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return this.respondWithError("Expected WebSocket connection");
    }

    const { userId, characterId } = this.extractUserId(request);

    if (userId == null || characterId == null) {
      return this.respondWithError("Internal error");
    }

    if (this.userId != null) {
      return this.respondWithError("Character is already in use by another session.", 409);
    }

    this.userId = userId;
    this.characterId = characterId;

    this.sessionId = await this.metadata.initialize(characterId, userId);
    await this.activeSessionTracker.touch(characterId, userId);

    this.startSelfMonitoring();

    const { 0: client, 1: server } = new WebSocketPair();
    this.clientWebSocket = client;
    server.accept();

    server.addEventListener("message", (event) => this.handleWebSocketMessage(event));

    server.addEventListener("close", () => {
      console.log(`❌ Session closed for user ${userId}`);
      this.clientWebSocket = null; // prevent sending any messages to closed socket
      this.releaseSession("user_closed");
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private extractUserId(request: Request) {
    const url = new URL(request.url);
    const userId = (url.searchParams.get("userId") || "").trim();
    const characterId = (url.searchParams.get("characterId") || "").trim();

    return {
      userId: userId === "" ? null : userId,
      characterId: characterId === "" ? null : characterId,
    };
  }

  private async releaseSession(endReason: SessionEndReason) {
    console.log(`🔓 Releasing session: ${this.sessionId}, reason=${endReason}`);

    if (endReason === "timeout" && this.clientWebSocket != null) {
      this.sendMessageToClient("session-end", { reason: endReason, message: "Session timed out" });
      await sleep(1000);
    }

    if (this.userId != null && this.characterId != null) {
      await this.activeSessionTracker.close(this.characterId, this.userId);
    }

    await this.metadata.endSession(endReason);
    this.stopSelfMonitoring();

    this.userId = null;
    this.sessionId = null;
    this.clientWebSocket = null;
  }

  private startSelfMonitoring() {
    if (this.sessionSelfMonitoringInterval != null) {
      return;
    }

    this.sessionSelfMonitoringInterval = setInterval(() => {
      const lastActivity = this.activeSessionTracker.getLastActivity();
      const timeSinceLastActivity = Date.now() - lastActivity;

      if (timeSinceLastActivity > SESSION_AUTO_RELEASE_TIMEOUT_MS) {
        console.log(`🔒 Session auto-released due to inactivity: ${this.sessionId}`);
        this.releaseSession("timeout");
      }
    }, SESSION_SELF_MONITORING_INTERVAL_MS);
  }

  private stopSelfMonitoring() {
    if (this.sessionSelfMonitoringInterval) {
      clearInterval(this.sessionSelfMonitoringInterval);
      this.sessionSelfMonitoringInterval = null;
    }
  }

  private respondWithError(message: SessionErrorMessage, status: number = 400) {
    return new Response(message, { status });
  }

  // very simple set of checks, not the best way to do this
  private isSystemRequest(request: Request) {
    const url = new URL(request.url);
    return url.pathname.startsWith(SESSION_SYSTEM_REQUEST_PATH_PREFIX) && request.headers.get("cf-ray") == null;
  }

  private async handleSystemRequest(request: Request) {
    // foolproof
    if (!this.isSystemRequest(request)) {
      return this.respondWithError("Unexpected error", 403);
    }

    const url = new URL(request.url);
    const systemCommand = url.pathname.split(SESSION_SYSTEM_REQUEST_PATH_PREFIX)[1];

    if (systemCommand === "state") {
      if (this.userId == null) {
        return this.respondWithError("No active session", 404);
      }
      const lastActivity = this.activeSessionTracker.getLastActivity();
      const metadata = await this.metadata.getMetadata();

      return new Response(
        JSON.stringify({
          ...metadata,
          lastActivity,
        }),
        { status: 200 },
      );
    }

    return this.respondWithError("Unexpected error", 404);
  }

  private async handleWebSocketMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data.toString());

      if (!WEBSOCKET_INCOMING_MESSAGE_TYPES.includes(message.type)) {
        throw new Error("Invalid message type");
      }

      if (this.userId == null || this.characterId == null) {
        throw new Error("Inactive session");
      }

      const type: WebSocketIncomingMessageType = message.type;

      if (type === "ping") {
        await this.handlePingMessage(this.userId, this.characterId);
      }

      if (type === "command") {
        await this.handleCommandMessage(message.payload, this.userId, this.characterId);
      }
    } catch (err) {
      console.error(`❌ Error processing WebSocket message: ${err}`);
      this.sendMessageToClient("error", { message: "Unknown error during processing message" });
    }
  }

  private async handlePingMessage(userId: string, characterId: string) {
    await this.activeSessionTracker.touch(characterId, userId);

    this.sendMessageToClient("pong", {
      lastActivity: this.activeSessionTracker.getLastActivity(),
      now: Date.now(),
    });
  }

  private async handleCommandMessage(data: unknown, userId: string, characterId: string) {
    if (!this.commandProcessor.enforceRateLimit(userId)) {
      console.log(`⚠️ User ${userId} exceeded rate limit.`);
      this.sendMessageToClient("error", { message: "Rate limit exceeded" });
      return;
    }

    const { command, args } = this.commandProcessor.parseCommand(data);

    await this.commandProcessor.processCommand(command, args);
    await this.metadata.addCommand(command, args);
    await this.activeSessionTracker.touch(characterId, userId);
  }

  private sendMessageToClient(type: WebSocketOutgoingMessageType, payload: any) {
    if (this.clientWebSocket == null) {
      return;
    }

    this.clientWebSocket.send(JSON.stringify({ type, payload }));
  }
}
