export const SESSION_COOKIE_NAME = "nutreenext_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  v: 1;
  iat: number;
  exp: number;
};

function getSessionSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "nutreenext-local-development-session-secret"
  );
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getHmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadPart = toBase64Url(payloadBytes);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getHmacKey(),
    new TextEncoder().encode(payloadPart),
  );
  return `${payloadPart}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined | null) {
  if (!token) return false;
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) return false;

  try {
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await getHmacKey(),
      fromBase64Url(signaturePart),
      new TextEncoder().encode(payloadPart),
    );
    if (!validSignature) return false;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1000);
    return payload.v === 1 && typeof payload.iat === "number" && typeof payload.exp === "number" && payload.iat <= now + 60 && payload.exp > now;
  } catch {
    return false;
  }
}
