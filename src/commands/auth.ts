import { Command } from "commander";
import readlineSync from "readline-sync";
import chalk from "chalk";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  exchangeCodeForSystemUserToken,
  getClientBusinessId,
  getAssignedInstagramAccounts,
  getMe,
} from "../lib/api";
import {
  loadConfig,
  saveConfig,
  configExists,
  getLoginType,
  Config,
  LoginType,
} from "../lib/config";
import { error, success, info, warn, daysUntil, formatDate } from "../lib/utils";

const DEFAULT_REDIRECT_URI = "https://localhost/";
const INSTAGRAM_LOGIN_SCOPES =
  "instagram_business_basic,instagram_business_content_publish";

interface SetupOptions {
  legacy?: boolean;
  redirectUri?: string;
  appId?: string;
  appSecret?: string;
  configId?: string;
  code?: string;
  token?: string;
  account?: string;
}

/**
 * A value from a flag (or env var); otherwise prompt — but only on a TTY. Without a TTY
 * (agents, scripts) readline-sync would block or read garbage, so a missing value is an error
 * that names the flag to pass.
 */
function ask(
  value: string | undefined,
  prompt: string,
  flag: string,
  opts: { mask?: boolean; optional?: boolean } = {}
): string {
  if (value && value.trim()) return value.trim();
  if (!process.stdin.isTTY) {
    if (opts.optional) return "";
    error(`${flag} is required when running non-interactively.`);
  }
  const answer = opts.mask
    ? readlineSync.question(prompt, { mask: "*" })
    : readlineSync.question(prompt);
  return answer.trim();
}

function unifiedAuthUrl(appId: string, configId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    config_id: configId,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

/** Unified Login is the default; --legacy selects Instagram Login (instagram.com OAuth). */
function resolveLoginType(opts: SetupOptions): LoginType {
  return opts.legacy ? "instagram" : "unified";
}

/** Accepts either the bare code or the full redirect URL (https://localhost/?code=...#_). */
function extractCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]code=([^&#]+)/);
  const code = match ? decodeURIComponent(match[1]) : trimmed;
  return code.replace(/#_$/, "");
}

function expiresAtFrom(expiresIn: number | undefined): string | null {
  return expiresIn && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;
}

/**
 * Unified Login: the token belongs to the business integration system user, so the
 * IG account must be discovered via /me/assigned_instagram_accounts.
 */
async function selectInstagramAccount(token: string, wanted?: string): Promise<string> {
  info("Fetching Instagram accounts assigned to this token...");
  let accounts: Array<{ id: string; username?: string }> = [];
  try {
    accounts = await getAssignedInstagramAccounts(token);
  } catch (e: any) {
    warn(`Could not list assigned Instagram accounts: ${e.message}`);
  }

  if (wanted) {
    const w = wanted.replace(/^@/, "").toLowerCase();
    const hit = accounts.find((a) => a.id === w || (a.username ?? "").toLowerCase() === w);
    if (hit) return hit.id;
    if (/^\d+$/.test(w)) return w; // an explicit numeric ID is trusted even if not listed
    error(
      `Instagram account "${wanted}" is not assigned to this token. Assigned: ` +
        (accounts.map((a) => `@${a.username ?? "?"} (${a.id})`).join(", ") || "none")
    );
  }

  if (accounts.length === 1) return accounts[0].id;

  if (accounts.length > 1) {
    if (!process.stdin.isTTY) {
      error(
        "Several Instagram accounts are assigned to this token — pass --account <username|id>: " +
          accounts.map((a) => `@${a.username ?? "?"} (${a.id})`).join(", ")
      );
    }
    const index = readlineSync.keyInSelect(
      accounts.map((a) => `@${a.username ?? "?"} (${a.id})`),
      "Which Instagram account should instacli use?",
      { cancel: false }
    );
    return accounts[index].id;
  }

  warn(
    "No Instagram account is assigned to this token. Usually the configuration is missing " +
      "the business_management permission (add it under Facebook Login for Business → Configurations)."
  );
  const manualId = ask(
    undefined,
    "Enter the Instagram professional account ID manually (empty to abort): ",
    "--account <id>",
    { optional: true }
  );
  if (!manualId) error("No Instagram account selected.");
  return manualId.trim();
}

async function finishUnifiedSetup(base: {
  app_id: string;
  app_secret: string;
  access_token: string;
  token_expires_at: string | null;
  config_id?: string;
}, account?: string): Promise<void> {
  const igUserId = await selectInstagramAccount(base.access_token, account);

  let clientBusinessId: string | undefined;
  try {
    clientBusinessId = await getClientBusinessId(base.access_token);
  } catch {
    // Optional: only needed for the SUAT management API.
  }

  const config: Config = {
    login_type: "unified",
    ...base,
    ig_user_id: igUserId,
    client_business_id: clientBusinessId,
  };

  const me = await getMe(config, false);
  saveConfig(config);
  success(`\nAuthenticated as @${me.username} (${me.user_id}) via Unified Login`);
  success("Config saved to ~/.instacli/config.json");
}

async function setupUnified(opts: SetupOptions): Promise<void> {
  console.log(chalk.bold("\n🔐 Instagram API with Unified Login\n"));
  console.log(
    "You need the Meta App ID/Secret (App settings → Basic, NOT the Instagram App ID) and the\n" +
      "Configuration ID from Use cases → Manage messaging & content on Instagram → API setup with Unified login.\n"
  );

  const appId = ask(opts.appId, "Enter your Meta App ID: ", "--app-id");
  const appSecret = ask(opts.appSecret, "Enter your Meta App Secret: ", "--app-secret", {
    mask: true,
  });
  const configId = ask(opts.configId, "Enter the Configuration ID (config_id): ", "--config-id");
  if (!appId || !appSecret || !configId) {
    error("Meta App ID, App Secret and Configuration ID are required.");
  }

  const redirectUri = opts.redirectUri || DEFAULT_REDIRECT_URI;
  const authUrl = unifiedAuthUrl(appId, configId, redirectUri);

  if (!opts.code && !process.stdin.isTTY) {
    error(
      "--code is required when running non-interactively. Open this login URL, log in, and pass " +
        `the URL you land on (https://localhost/?code=...) as --code:\n${authUrl}`
    );
  }

  console.log(`\n${chalk.bold("Step 1:")} Open this URL in your browser:\n`);
  console.log(chalk.underline(authUrl));
  console.log(
    `\n${chalk.bold("Step 2:")} Log in with Instagram or Facebook, pick the business portfolio and Instagram account.`
  );
  console.log(
    `You'll be redirected to ${redirectUri} — copy the full URL (or just the code=... value).\n`
  );

  const code = extractCode(ask(opts.code, "Paste the redirect URL or code: ", "--code"));
  if (!code) error("Authorization code is required.");

  info("\nExchanging code for system-user access token...");
  const token = await exchangeCodeForSystemUserToken(appId, appSecret, code, redirectUri);

  await finishUnifiedSetup({
    app_id: appId,
    app_secret: appSecret,
    access_token: token.access_token,
    token_expires_at: expiresAtFrom(token.expires_in),
    config_id: configId,
  }, opts.account);
}

async function setupInstagramLogin(opts: SetupOptions): Promise<void> {
  console.log(chalk.bold("\n🔐 Instagram API with Instagram Login (legacy)\n"));

  const appId = readlineSync.question("Enter your Instagram App ID: ");
  const appSecret = readlineSync.question("Enter your Instagram App Secret: ", {
    mask: "*",
  });

  if (!appId || !appSecret) {
    error("App ID and App Secret are required.");
  }

  const redirectUri = opts.redirectUri || DEFAULT_REDIRECT_URI;
  const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${INSTAGRAM_LOGIN_SCOPES}`;

  console.log(`\n${chalk.bold("Step 1:")} Open this URL in your browser:\n`);
  console.log(chalk.underline(authUrl));
  console.log(
    `\n${chalk.bold("Step 2:")} After authorizing, you'll be redirected to a localhost URL.`
  );
  console.log("Copy the full URL (or just the code=... value).\n");

  const code = extractCode(readlineSync.question("Paste the redirect URL or code: "));
  if (!code) {
    error("Authorization code is required.");
  }

  info("\nExchanging code for short-lived token...");
  const shortLived = await exchangeCodeForToken(appId, appSecret, code, redirectUri);

  info("Exchanging for long-lived token...");
  const longLived = await exchangeForLongLivedToken(appSecret, shortLived.access_token);

  info("Fetching account info...");
  const config: Config = {
    login_type: "instagram",
    app_id: appId,
    app_secret: appSecret,
    access_token: longLived.access_token,
    ig_user_id: "",
    token_expires_at: expiresAtFrom(longLived.expires_in),
  };

  const me = await getMe(config, false);
  config.ig_user_id = me.user_id;

  saveConfig(config);
  success(`\nAuthenticated as @${me.username} (${me.user_id})`);
  success("Config saved to ~/.instacli/config.json");
}

async function manualTokenUnified(opts: SetupOptions): Promise<void> {
  console.log("Generate a token in the Meta App Dashboard:");
  console.log(
    "Use cases → Manage messaging & content on Instagram → API setup with Unified login → Generate access tokens\n"
  );

  const appId = ask(opts.appId, "Enter your Meta App ID: ", "--app-id");
  const appSecret = ask(opts.appSecret, "Enter your Meta App Secret: ", "--app-secret", {
    mask: true,
  });
  const token = ask(opts.token, "Paste the generated token: ", "--token");
  if (!appId || !appSecret || !token) {
    error("All fields are required.");
  }

  try {
    await finishUnifiedSetup({
      app_id: appId,
      app_secret: appSecret,
      access_token: token.trim(),
      // Dashboard-generated SUATs follow the configuration's expiry; we can't read it here.
      token_expires_at: null,
    }, opts.account);
  } catch (e: any) {
    error(`Failed to verify token: ${e.message}`);
  }
}

async function manualTokenInstagramLogin(): Promise<void> {
  console.log("Generate a token in the Meta Developer Console:");
  console.log("Instagram API with Instagram Login → Generate token\n");

  const appId = readlineSync.question("Enter your Instagram App ID: ");
  const appSecret = readlineSync.question("Enter your Instagram App Secret: ", { mask: "*" });
  const token = readlineSync.question("Paste the generated token: ");

  if (!appId || !appSecret || !token) {
    error("All fields are required.");
  }

  info("\nFetching account info...");
  const config: Config = {
    login_type: "instagram",
    app_id: appId,
    app_secret: appSecret,
    access_token: token,
    ig_user_id: "",
    token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  };

  try {
    const me = await getMe(config, false);

    // Try to exchange for long-lived token
    info("Exchanging for long-lived token...");
    try {
      const longLived = await exchangeForLongLivedToken(appSecret, token);
      config.access_token = longLived.access_token;
      config.token_expires_at = expiresAtFrom(longLived.expires_in);
      success("Got long-lived token (60 days)!");
    } catch {
      info("Could not exchange for long-lived token. Using provided token as-is.");
    }

    config.ig_user_id = me.user_id;
    saveConfig(config);
    success(`\nAuthenticated as @${me.username} (${me.user_id})`);
    success("Config saved to ~/.instacli/config.json");
  } catch (e: any) {
    error(`Failed to verify token: ${e.message}`);
  }
}

/** Flags win; env vars fill the gaps (keeps the secret out of the shell history / process list). */
function withEnv(opts: SetupOptions): SetupOptions {
  return {
    ...opts,
    appId: opts.appId || process.env.INSTACLI_APP_ID,
    appSecret: opts.appSecret || process.env.INSTACLI_APP_SECRET,
    configId: opts.configId || process.env.INSTACLI_CONFIG_ID,
  };
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Authentication management");

  auth
    .command("setup")
    .description("Interactive guided authentication setup (Unified Login)")
    .option("--legacy", "Use the legacy Instagram Login instead of Unified Login")
    .option("--redirect-uri <uri>", "OAuth redirect URI configured in the Meta app", DEFAULT_REDIRECT_URI)
    .option("--app-id <id>", "Meta App ID (Unified Login; default: env INSTACLI_APP_ID)")
    .option("--app-secret <secret>", "Meta App Secret (default: env INSTACLI_APP_SECRET)")
    .option("--config-id <id>", "Configuration ID (default: env INSTACLI_CONFIG_ID)")
    .option("--code <url-or-code>", "Redirect URL or code from the login (skips the prompt)")
    .option("--account <username|id>", "Instagram account to use if several are assigned")
    .action(async (opts: SetupOptions) => {
      const loginType = resolveLoginType(opts);
      if (loginType === "unified") {
        await setupUnified(withEnv(opts));
      } else {
        await setupInstagramLogin(opts);
      }
    });

  auth
    .command("token")
    .description("Manually set a token generated in the Meta App Dashboard (Unified Login)")
    .option("--legacy", "Use the legacy Instagram Login instead of Unified Login")
    .option("--app-id <id>", "Meta App ID (Unified Login; default: env INSTACLI_APP_ID)")
    .option("--app-secret <secret>", "Meta App Secret (default: env INSTACLI_APP_SECRET)")
    .option("--token <token>", "Access token generated in the Meta App Dashboard")
    .option("--account <username|id>", "Instagram account to use if several are assigned")
    .action(async (opts: SetupOptions) => {
      console.log(chalk.bold("\n🔑 Manual Token Setup\n"));
      const loginType = resolveLoginType(opts);
      if (loginType === "unified") {
        await manualTokenUnified(withEnv(opts));
      } else {
        await manualTokenInstagramLogin();
      }
    });

  auth
    .command("url")
    .description("Print the Unified Login URL (step 1 of a non-interactive setup)")
    .option("--app-id <id>", "Meta App ID (default: env INSTACLI_APP_ID)")
    .option("--config-id <id>", "Configuration ID (default: env INSTACLI_CONFIG_ID)")
    .option("--redirect-uri <uri>", "OAuth redirect URI configured in the Meta app", DEFAULT_REDIRECT_URI)
    .action((raw: SetupOptions) => {
      const opts = withEnv(raw);
      if (!opts.appId || !opts.configId) error("--app-id and --config-id are required.");
      console.log(unifiedAuthUrl(opts.appId, opts.configId, opts.redirectUri || DEFAULT_REDIRECT_URI));
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(async () => {
      if (!configExists()) {
        error("Not configured. Run `instacli auth setup` first.");
      }

      const config = loadConfig();
      const loginType = getLoginType(config);

      try {
        const me = await getMe(config, false);

        console.log(chalk.bold("\nAuth Status"));
        console.log(
          `  Login:        ${loginType === "unified" ? "Unified Login" : "Instagram Login (legacy)"}`
        );
        console.log(`  Username:     @${me.username}`);
        console.log(`  User ID:      ${config.ig_user_id}`);
        if (config.token_expires_at) {
          const days = daysUntil(config.token_expires_at);
          console.log(`  Token Expiry: ${formatDate(config.token_expires_at)}`);
          console.log(
            `  Days Left:    ${days > 7 ? chalk.green(days) : days > 0 ? chalk.yellow(days) : chalk.red(days)}`
          );
        } else {
          console.log(`  Token Expiry: ${chalk.green("never")}`);
        }
        if (loginType === "instagram") {
          console.log(
            chalk.yellow(
              "\n  Instagram Login is legacy at Meta. Re-run `instacli auth setup` to switch to Unified Login."
            )
          );
        }
        console.log();
      } catch (e: any) {
        error(`Token may be expired or revoked: ${e.message}`);
      }
    });

  auth
    .command("refresh")
    .description("Refresh the long-lived token (Instagram Login only, extends 60 days)")
    .action(async () => {
      if (!configExists()) {
        error("Not configured. Run `instacli auth setup` first.");
      }

      const config = loadConfig();

      if (getLoginType(config) === "unified") {
        if (!config.token_expires_at) {
          success("Unified Login system-user token does not expire — nothing to refresh.");
          return;
        }
        error(
          "Unified Login tokens can't be refreshed by instacli. Re-run `instacli auth setup` before the token expires."
        );
      }

      info("Refreshing token...");

      const result = await refreshLongLivedToken(config.access_token);
      const expiresAt = new Date(
        Date.now() + result.expires_in * 1000
      ).toISOString();

      config.access_token = result.access_token;
      config.token_expires_at = expiresAt;
      saveConfig(config);

      success("Token refreshed successfully!");
      console.log(`  New expiry: ${formatDate(expiresAt)}`);
      console.log(`  Days left:  ${daysUntil(expiresAt)}`);
    });
}
