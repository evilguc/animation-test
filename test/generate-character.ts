import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const serviceApiPrivateKeyPath = path.resolve("output/service-api-private.pem");
const sessionPrivateKeyPath = path.resolve("output/session-private.pem");

// Generate random ID
function generateRandomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const userId = process.argv[2] || generateRandomId("user");
const characterId = generateRandomId("char");
const host = process.env.HOST || "http://localhost:8787";

if (!fs.existsSync(serviceApiPrivateKeyPath)) {
  console.error("⚠️ Service API private key not found. Run `generate-jwt.ts` first.");
  process.exit(1);
}
const serviceApiPrivateKey = fs.readFileSync(serviceApiPrivateKeyPath, "utf8");

if (!fs.existsSync(sessionPrivateKeyPath)) {
  console.error("⚠️ Session private key not found. Run `generate-jwt.ts` first.");
  process.exit(1);
}
const sessionPrivateKey = fs.readFileSync(sessionPrivateKeyPath, "utf8");

const serviceApiToken = jwt.sign({ sub: "service-api-admin" }, serviceApiPrivateKey, { algorithm: "RS256" });
const userToken = jwt.sign({ sub: userId }, sessionPrivateKey, { algorithm: "RS256" });

console.log("\n🚀 Generated Character Ownership Request\n");
console.log(`🔹 User ID: ${userId}`);
console.log(`🔹 Character ID: ${characterId}\n`);
console.log("📌 Use this command to create the ownership record:\n");

console.log(`curl -X POST ${host}/service-api/test/setup-character-ownership \\
  -H "Authorization: Bearer ${serviceApiToken}" \\
  -H "Content-Type: application/json" \\
  -d '[{"userId": "${userId}", "characterId": "${characterId}"}]'\n`);

console.log("\n🔑 JWT token for this user:");
console.log(userToken);

console.log(`To generate another character for this user, run:\n`);
console.log(`npm run generate-character ${userId}\n`);
