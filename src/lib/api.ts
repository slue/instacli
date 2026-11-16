import fetch from "node-fetch";
import { Config, getLoginType } from "./config";

// Instagram API with Instagram Login (legacy) talks to graph.instagram.com,
// Instagram API with Unified Login talks to graph.facebook.com.
const INSTAGRAM_LOGIN_API_BASE = "https://graph.instagram.com/v22.0";
export const UNIFIED_API_VERSION = "v27.0";
const UNIFIED_API_BASE = `https://graph.facebook.com/${UNIFIED_API_VERSION}`;

function apiBase(config: Config): string {
  return getLoginType(config) === "unified"
    ? UNIFIED_API_BASE
    : INSTAGRAM_LOGIN_API_BASE;
}

interface ApiError {
  error: { message: string; type: string; code: number };
}

async function request(
  url: string,
  options?: { method?: string; body?: URLSearchParams }
): Promise<any> {
  const res = await fetch(url, {
    method: options?.method || "GET",
    body: options?.body,
  });
  const data = await res.json();
  if ((data as ApiError).error) {
    throw new Error((data as ApiError).error.message);
  }
  return data;
}

// Auth endpoints (not versioned the same way)

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; user_id: string }> {
  const body = new URLSearchParams();
  body.append("client_id", clientId);
  body.append("client_secret", clientSecret);
  body.append("grant_type", "authorization_code");
  body.append("redirect_uri", redirectUri);
  body.append("code", code);

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });
  const data = await res.json();
  if ((data as ApiError).error) {
    throw new Error((data as ApiError).error.message);
  }
  return data as { access_token: string; user_id: string };
}

export async function exchangeForLongLivedToken(
  clientSecret: string,
  shortToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const url = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(shortToken)}`;
  return request(url);
}

export async function refreshLongLivedToken(
  token: string
): Promise<{ access_token: string; expires_in: number }> {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  return request(url);
}

// Unified Login auth (Facebook Login for Business with config_id)

export async function exchangeCodeForSystemUserToken(
  appId: string,
  appSecret: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  return request(`${UNIFIED_API_BASE}/oauth/access_token?${params}`);
}

// With a SUAT, /me is the business integration system user, not the IG account.
export async function getClientBusinessId(token: string): Promise<string | undefined> {
  const url = `${UNIFIED_API_BASE}/me?fields=client_business_id&access_token=${encodeURIComponent(token)}`;
  const data = await request(url);
  return data.client_business_id;
}

export async function getAssignedInstagramAccounts(
  token: string
): Promise<Array<{ id: string; username?: string }>> {
  const url = `${UNIFIED_API_BASE}/me/assigned_instagram_accounts?fields=id,username&limit=100&access_token=${encodeURIComponent(token)}`;
  const data = await request(url);
  return data.data || [];
}

// User endpoints

export interface Account {
  user_id: string;
  username?: string;
  name?: string;
  account_type?: string;
  media_count?: number;
  followers_count?: number;
  follows_count?: number;
}

/**
 * Account info of the connected Instagram professional account.
 * Instagram Login: GET graph.instagram.com/me (fields user_id, account_type exist).
 * Unified Login:  GET graph.facebook.com/{ig-user-id} (IG User node, no user_id/account_type).
 */
export async function getMe(config: Config, full = true): Promise<Account> {
  const token = encodeURIComponent(config.access_token);
  if (getLoginType(config) === "unified") {
    const fields = full
      ? "id,username,name,media_count,followers_count,follows_count"
      : "id,username";
    const data = await request(
      `${UNIFIED_API_BASE}/${config.ig_user_id}?fields=${fields}&access_token=${token}`
    );
    const { id, ...rest } = data;
    return { user_id: id, ...rest };
  }
  const fields = full
    ? "user_id,username,name,account_type,media_count,followers_count,follows_count"
    : "user_id,username";
  return request(`${INSTAGRAM_LOGIN_API_BASE}/me?fields=${fields}&access_token=${token}`);
}

// Media endpoints

export async function createMediaContainer(
  config: Config,
  params: Record<string, string>
): Promise<{ id: string }> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value);
  }
  body.append("access_token", config.access_token);

  const url = `${apiBase(config)}/${config.ig_user_id}/media`;
  return request(url, { method: "POST", body });
}

export async function getContainerStatus(
  config: Config,
  containerId: string
): Promise<{ status_code: string }> {
  const url = `${apiBase(config)}/${containerId}?fields=status_code&access_token=${encodeURIComponent(config.access_token)}`;
  return request(url);
}

export async function publishMedia(
  config: Config,
  containerId: string
): Promise<{ id: string }> {
  const body = new URLSearchParams();
  body.append("creation_id", containerId);
  body.append("access_token", config.access_token);

  const url = `${apiBase(config)}/${config.ig_user_id}/media_publish`;
  return request(url, { method: "POST", body });
}

export async function listMedia(
  config: Config,
  limit: number = 10
): Promise<any> {
  const fields =
    "id,caption,media_type,timestamp,permalink,like_count,comments_count";
  const url = `${apiBase(config)}/${config.ig_user_id}/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(config.access_token)}`;
  return request(url);
}

export async function getMediaInfo(
  config: Config,
  mediaId: string
): Promise<any> {
  const fields =
    "id,caption,media_type,media_url,timestamp,permalink,like_count,comments_count";
  const url = `${apiBase(config)}/${mediaId}?fields=${fields}&access_token=${encodeURIComponent(config.access_token)}`;
  return request(url);
}

export async function deleteMedia(
  config: Config,
  mediaId: string
): Promise<any> {
  const url = `${apiBase(config)}/${mediaId}?access_token=${encodeURIComponent(config.access_token)}`;
  return request(url, { method: "DELETE" });
}

// DM / Messaging endpoints

export async function getConversations(config: Config, limit = 20): Promise<any> {
  const url = `${apiBase(config)}/${config.ig_user_id}/conversations?platform=instagram&fields=participants,messages.limit(1){message,from,timestamp}&limit=${limit}&access_token=${encodeURIComponent(config.access_token)}`;
  return request(url);
}

export async function getMessages(config: Config, conversationId: string): Promise<any> {
  const url = `${apiBase(config)}/${conversationId}?fields=messages{message,from,timestamp}&access_token=${encodeURIComponent(config.access_token)}`;
  return request(url);
}

export async function sendMessage(config: Config, recipientId: string, text: string): Promise<any> {
  const url = `${apiBase(config)}/${config.ig_user_id}/messages`;
  const body = new URLSearchParams();
  body.append("recipient", JSON.stringify({ id: recipientId }));
  body.append("message", JSON.stringify({ text }));
  body.append("access_token", config.access_token);
  return request(url, { method: "POST", body });
}

// Polling helper

export async function pollContainerStatus(
  config: Config,
  containerId: string,
  intervalMs: number = 5000,
  timeoutMs: number = 60000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getContainerStatus(config, containerId);
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error(`Container ${containerId} failed with status ERROR`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `Container ${containerId} did not finish within ${timeoutMs / 1000}s`
  );
}
