import fs from "fs";
import path from "path";
import os from "os";

export interface Config {
  app_id: string;
  app_secret: string;
  access_token: string;
  ig_user_id: string;
  token_expires_at: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".instacli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

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
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}
