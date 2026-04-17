// api/_lib.js — shared helpers for all API routes

import { createClient } from '@libsql/client';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// ── Turso client ─────────────────────────────────────────
export function getDB() {
  return createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// ── JWT helpers ──────────────────────────────────────────
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(await secret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, await secret());
    return payload;
  } catch {
    return null;
  }
}

export function getToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.replace('Bearer ', '').trim() || null;
}

// ── Password helpers ─────────────────────────────────────
export const hashPassword    = (p) => bcrypt.hash(p, 10);
export const comparePassword = (p, h) => bcrypt.compare(p, h);

// ── Response helpers ─────────────────────────────────────
export function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, ...data });
}

export function err(res, message, status = 400) {
  res.status(status).json({ ok: false, error: message });
}

// ── CORS headers ─────────────────────────────────────────
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}
