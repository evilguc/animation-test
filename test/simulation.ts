import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import axios from "axios";
import fs from "fs";
import { WebSocket } from "ws";
import { setTimeout as sleep } from "timers/promises";

dotenv.config();

const testUsers = [
  { userId: "user1", characterId: "characterA" },
  { userId: "user2", characterId: "characterB" },
  { userId: "user3", characterId: "characterC" },
  { userId: "user1", characterId: "characterE" },
  { userId: "user2", characterId: "characterF" },
];

const testCommands = [
  { command: "move", args: { x: 10, y: 20 } },
  { command: "start", args: { speed: 5 } },
  { command: "rotate", args: { angle: 90 } },
  { command: "stop", args: {} },
  { command: "reset", args: {} },
];

(async () => {
  try {
    await setup();

    setInterval(listActiveSessions, 2000);
    setInterval(() => getActiveSessionState("characterA"), 2000);
    setInterval(() => listCharacterSessions("characterA"), 2000);
    setInterval(() => getCharacterSessionFromHistory("characterA", "01951f44-8868-73ae-bf1f-7f12fc2517b8"), 2000);
    setInterval(() => getCommandsForCharacter("characterA"), 2000);

    await sleep(3_000);

    await Promise.allSettled([
      simulateUser("user1", "characterA"),
      simulateUser("user2", "characterB"),
      simulateUser("user3", "characterC"),
      simulateUser("user1", "characterE"),
      simulateUser("user2", "characterF"),

      simulateUser("user1", "characterA"),
      simulateUser("user5", "characterA"),
      simulateUser("user2", "characterA"),
    ]);

    await sleep(3_000);

    process.exit(0);
  } catch (error: any) {
    console.error(error);
    process.exit(1);
  }
})();

async function setup() {
  console.log("Setting up users and characters...");
  await setupUsersAndCharacters();
}

async function simulateUser(userId: string, characterId: string) {
  console.log(`Starting session for user ${userId} and character ${characterId}...`);

  const ws = new WebSocket(getSessionUrl(characterId), {
    headers: {
      authorization: `Bearer ${generateSessionJwt(userId)}`,
    },
  });

  ws.on("open", () => {
    console.log("✅ WebSocket connected");

    // create a list of 3-10 random commands
    const commands = Array.from({ length: Math.floor(Math.random() * 8) + 3 }, () => {
      const command = testCommands[Math.floor(Math.random() * testCommands.length)];
      return { type: "command", payload: { command: command.command, args: command.args } };
    });

    // send commands with a small random delay between each
    commands.forEach((command, index) => {
      setTimeout(() => ws.send(JSON.stringify(command)), index * 1000);
    });

    // Keep alive
    setInterval(() => ws.send(JSON.stringify({ type: "ping" })), 5000);
  });

  ws.on("message", (data) => {
    console.log("📩 Message received:", data.toString());
  });

  ws.on("close", (code, reason) => {
    console.log(`❌ WebSocket closed (${code}): ${reason}`);
  });

  ws.on("error", (err) => {
    console.error("🚨 WebSocket error:", err);
  });

  ws.on("unexpected-response", (req, res) => {
    console.error(`❌ WebSocket connection failed: ${res.statusCode} - ${res.statusMessage}`);

    res.on("data", (chunk) => {
      console.error("❌ Server Response:", chunk.toString());
    });
  });

  await sleep(10_000);
  ws.close();
}

async function listActiveSessions() {
  try {
    const response = await axios.get(getServiceApiUrl("/sessions/active"), {
      headers: { Authorization: `Bearer ${generateServiceApiJwt()}` },
    });

    console.log("Active sessions:", JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error(`❌ Error listing active sessions. Status: ${err.response?.status}`);
  }
}

async function getActiveSessionState(characterId: string) {
  try {
    const response = await axios.get(getServiceApiUrl(`/session/${characterId}/active`), {
      headers: { Authorization: `Bearer ${generateServiceApiJwt()}` },
    });

    console.log(`Session state for ${characterId}:`, JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error(`❌ Error getting session state for ${characterId}. Status: ${err.response?.status}`);
  }
}

async function listCharacterSessions(characterId: string) {
  try {
    const response = await axios.get(getServiceApiUrl(`/sessions/history/${characterId}`), {
      headers: { Authorization: `Bearer ${generateServiceApiJwt()}` },
    });

    console.log(`Session history for ${characterId}:`, JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error(`❌ Error listing sessions for ${characterId}. Status: ${err.response?.status}`);
  }
}

async function getCharacterSessionFromHistory(characterId: string, sessionId: string) {
  try {
    const response = await axios.get(getServiceApiUrl(`/session/history/${characterId}/${sessionId}`), {
      headers: { Authorization: `Bearer ${generateServiceApiJwt()}` },
    });

    console.log(`Session ${sessionId} for ${characterId}:`, JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error(`❌ Error getting session ${sessionId} for ${characterId}. Status: ${err.response?.status}`);
  }
}

async function getCommandsForCharacter(characterId: string) {
  try {
    const response = await axios.get(getServiceApiUrl(`/character/commands/${characterId}`), {
      headers: { Authorization: `Bearer ${generateServiceApiJwt()}` },
    });

    console.log(`Commands for ${characterId}:`, JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error(`❌ Error getting commands for ${characterId}. Status: ${err.response?.status}`);
  }
}

async function setupUsersAndCharacters() {
  await axios.post(getServiceApiUrl("/test/setup-character-ownership"), testUsers, {
    headers: { Authorization: `Bearer ${generateServiceApiJwt()}` },
  });
}

function getServiceApiUrl(shortPath: string) {
  const serviceApiUrl = requireEnv("SERVICE_API_URL");
  return `${serviceApiUrl}/service-api${shortPath}`;
}

function getSessionUrl(characterId: string) {
  const sessionUrl = requireEnv("SESSIONS_URL");
  return `${sessionUrl}/session/${characterId}`;
}

function generateServiceApiJwt() {
  const serviceApiPrivateKeyPath = requireEnv("SERVICE_API_PRIVATE_KEY_PATH");
  return generateJWT("service-api-admin", serviceApiPrivateKeyPath);
}

function generateSessionJwt(userId: string) {
  const sessionPrivateKeyPath = requireEnv("SESSIONS_PRIVATE_KEY_PATH");
  return generateJWT(userId, sessionPrivateKeyPath);
}

function generateJWT(subject: string, privateKeyPath: string) {
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");
  return jwt.sign({ sub: subject }, privateKey, { algorithm: "RS256" });
}

function requireEnv(key: string) {
  const value = process.env[key];
  if (value == null) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}
