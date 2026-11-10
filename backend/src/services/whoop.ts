const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2';
const WHOOP_API_URL = 'https://api.prod.whoop.com/developer/v1';

const CLIENT_ID = process.env.WHOOP_CLIENT_ID!;
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET!;
const REDIRECT_URI = process.env.WHOOP_REDIRECT_URI!;

const SCOPES = [
  'read:recovery',
  'read:sleep',
  'read:workout',
  'read:profile',
  'read:body_measurement',
  'read:cycles',
].join(' ');

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  });
  return `${WHOOP_AUTH_URL}/auth?${params}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(`${WHOOP_AUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`WHOOP token exchange failed: ${res.status}`);
  return res.json();
}

export async function refreshToken(refresh_token: string) {
  const res = await fetch(`${WHOOP_AUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`WHOOP token refresh failed: ${res.status}`);
  return res.json();
}

async function whoopFetch(path: string, accessToken: string) {
  const res = await fetch(`${WHOOP_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`WHOOP API ${path} failed: ${res.status}`);
  return res.json();
}

export async function fetchProfile(accessToken: string) {
  return whoopFetch('/user/profile/basic', accessToken);
}

export async function fetchSleep(accessToken: string, startDate: string) {
  return whoopFetch(`/activity/sleep?start=${startDate}T00:00:00.000Z&limit=25`, accessToken);
}

export async function fetchRecovery(accessToken: string, startDate: string) {
  return whoopFetch(`/recovery?start=${startDate}T00:00:00.000Z&limit=25`, accessToken);
}

export async function fetchWorkouts(accessToken: string, startDate: string) {
  return whoopFetch(`/activity/workout?start=${startDate}T00:00:00.000Z&limit=25`, accessToken);
}
