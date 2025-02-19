import { jwtVerify } from "jose";

const AUTH_ERROR_MESSAGES = ["Missing Authorization header", "Invalid token"] as const;

type AuthErrorMessage = (typeof AUTH_ERROR_MESSAGES)[number];

export class AuthenticationError extends Error {
  constructor(message: AuthErrorMessage) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function authenticateRequest(req: Request, env: Env) {
  const authHeader = req.headers.get("Authorization");

  if (authHeader == null) {
    throw new AuthenticationError("Missing Authorization header");
  }

  const token = authHeader.split("Bearer ")[1];

  if (token == null) {
    throw new AuthenticationError("Invalid token");
  }

  const publicKeyBase64 = env.SERVICE_API_JWT_PUBLIC_KEY_BASE64;

  try {
    const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0)).buffer;
    const publicKeyCrypto = await crypto.subtle.importKey("spki", publicKeyBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, [
      "verify",
    ]);
    await jwtVerify(token, publicKeyCrypto, { algorithms: ["RS256"] });
  } catch (err) {
    console.error(err);
    throw new AuthenticationError("Invalid token");
  }
}
