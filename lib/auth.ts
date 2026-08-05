import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

const COOKIE_NAME = "muhasabah_session";
const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return encoder.encode(secret);
}

export async function hashPassphrase(passphrase: string) {
  return argon2.hash(passphrase, { type: argon2.argon2id });
}

export async function verifyPassphrase(hash: string, passphrase: string) {
  return argon2.verify(hash, passphrase);
}

export async function issueSession(adminId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, getSecret());
    return { sub: verified.payload.sub as string };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function getAdminConfig() {
  const admin = await db.admin.findFirst();
  if (!admin) {
    throw new Error("Admin is not initialized. Run npm run setup.");
  }
  return admin;
}

export async function authenticate(passphrase: string) {
  const admin = await db.admin.findFirst();
  if (!admin) return null;

  const valid = await verifyPassphrase(admin.passphraseHash, passphrase);
  return valid ? admin : null;
}
