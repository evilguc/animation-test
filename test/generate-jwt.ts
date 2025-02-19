import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

// Ensure output directory exists
const outputDir = path.resolve("output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Function to generate RSA key pair
function generateRSAKeyPair(prefix: string) {
  const privateKeyPath = path.join(outputDir, `${prefix}-private.pem`);
  const publicKeyPath = path.join(outputDir, `${prefix}-public.pem`);
  const publicKeyDERPath = path.join(outputDir, `${prefix}-public.der`);

  console.log(`🔑 Generating RSA keys for ${prefix}...`);

  // 1️⃣ Generate Private Key (Silent)
  execSync(`openssl genpkey -algorithm RSA -out ${privateKeyPath} -pkeyopt rsa_keygen_bits:2048`, { stdio: "ignore" });

  // 2️⃣ Extract Public Key (PEM format) (Silent)
  execSync(`openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`, { stdio: "ignore" });

  // 3️⃣ Convert Public Key to DER format (Silent)
  execSync(`openssl rsa -in ${privateKeyPath} -pubout -outform DER -out ${publicKeyDERPath}`, { stdio: "ignore" });

  // 4️⃣ Read the DER file & convert to Base64
  const derKey = fs.readFileSync(publicKeyDERPath);
  const base64Key = derKey.toString("base64");

  console.log(`✅ Keys for ${prefix} saved in ./output/`);
  return { privateKeyPath, base64Key };
}

// ✅ Generate RSA keys
const sessionKeys = generateRSAKeyPair("session");
const serviceApiKeys = generateRSAKeyPair("service-api");

// ✅ Generate JWT token for service-api-admin
function generateJWT(privateKeyPath: string, subject: string): string {
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");
  return jwt.sign({ sub: subject }, privateKey, { algorithm: "RS256" });
}

const serviceApiToken = generateJWT(serviceApiKeys.privateKeyPath, "service-api-admin");

// ✅ Write to `output/.dev.vars`
const devVarsContent = `SESSION_JWT_PUBLIC_KEY_BASE64="${sessionKeys.base64Key}"
SERVICE_API_JWT_PUBLIC_KEY_BASE64="${serviceApiKeys.base64Key}"
`;

const devVarsPath = path.join(outputDir, ".dev.vars");
fs.writeFileSync(devVarsPath, devVarsContent);

console.log("\n🚀 Generated Keys & JWT Token\n");

console.log("🔧 Env vars written to `output/.dev.vars`\n");
console.log(devVarsContent);

console.log("\n🔑 JWT token for Bearer Authentication (service-api-admin):");
console.log(serviceApiToken);
