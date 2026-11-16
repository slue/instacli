import fs from "fs";
import path from "path";
import os from "os";

/**
 * - "instagram": Instagram API with Instagram Login (legacy). Instagram User token,
 *   host graph.instagram.com, 60-day token refreshable via ig_refresh_token.
 * - "unified":   Instagram API with Unified Login. Facebook Login for Business
 *   (config_id), Business Integration System User token (SUAT), host graph.facebook.com.
 */
export type LoginType = "instagram" | "unified";

export interface Config {
  /** Missing in configs written before Unified Login support → treated as "instagram". */
  login_type?: LoginType;
  app_id: string;
  app_secret: string;
  access_token: string;
  ig_user_id: string;
  /** ISO date, or null when the token never expires (default for Unified Login SUATs). */
  token_expires_at: string | null;
  /** Unified Login only: the Facebook Login for Business configuration ID. */
  config_id?: string;
  /** Unified Login only: the client's business portfolio ID (needed for SUAT management). */
  client_business_id?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".instacli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function getLoginType(config: Config): LoginType {
  return config.login_type ?? "instagram";
}

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      "Not configured. Run `instacli auth setup` to get started."
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

export function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}
