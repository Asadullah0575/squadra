// js/api.js — all fetch calls to our Vercel API routes

const BASE = '/api';

function token() { return localStorage.getItem('sq_token'); }

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type':  'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ─────────────────────────────────────────────────
export async function apiSignUp(email, password) {
  const data = await req('/auth?action=signup', { method: 'POST', body: { email, password } });
  localStorage.setItem('sq_token', data.token);
  localStorage.setItem('sq_user',  JSON.stringify(data.user));
  return data.user;
}

export async function apiSignIn(email, password) {
  const data = await req('/auth?action=signin', { method: 'POST', body: { email, password } });
  localStorage.setItem('sq_token', data.token);
  localStorage.setItem('sq_user',  JSON.stringify(data.user));
  return data.user;
}

export function apiSignOut() {
  localStorage.removeItem('sq_token');
  localStorage.removeItem('sq_user');
}

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('sq_user')); } catch { return null; }
}

// ── Profiles ─────────────────────────────────────────────
export async function apiGetProfiles() {
  const data = await req('/profiles');
  return data.profiles;
}

export async function apiPostProfile(profile) {
  const data = await req('/profiles', { method: 'POST', body: profile });
  return data.profile;
}

export async function apiDeleteProfile(id) {
  await req(`/profiles?id=${id}`, { method: 'DELETE' });
}

// ── Invites ──────────────────────────────────────────────
export async function apiGetInvites() {
  const data = await req('/invites');
  return data.invites;
}

export async function apiSendInvite(toProfileId) {
  await req('/invites', { method: 'POST', body: { toProfileId } });
}
