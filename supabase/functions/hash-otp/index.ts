import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts"

const SALT_LENGTH = 16
const ITERATIONS = 100_000

async function hashCode(code: string, salt?: Uint8Array): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder()
  const s = salt ?? crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"])
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: s, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  )
  const hashHex = new TextDecoder().decode(hexEncode(new Uint8Array(derived)))
  const saltHex = new TextDecoder().decode(hexEncode(s))
  return { hash: `pbkdf2:${ITERATIONS}:${saltHex}:${hashHex}`, salt: saltHex }
}

async function verifyCode(code: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":")
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false
  const saltBytes = new Uint8Array(parts[2].match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  const { hash } = await hashCode(code, saltBytes)
  return hash === storedHash
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const { code, hash: hashToVerify } = await req.json()

    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "code requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Mode vérification
    if (hashToVerify) {
      const valid = await verifyCode(code, hashToVerify)
      return new Response(
        JSON.stringify({ valid }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Mode hashage
    const { hash } = await hashCode(code)
    return new Response(
      JSON.stringify({ hash }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
