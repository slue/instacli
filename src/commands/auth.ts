import { Command } from "commander";
import readlineSync from "readline-sync";
import chalk from "chalk";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  getMe,
} from "../lib/api";
import { loadConfig, saveConfig, configExists, Config } from "../lib/config";
import { error, success, info, daysUntil, formatDate } from "../lib/utils";

const REDIRECT_URI = "https://localhost/";
const SCOPES =
  "instagram_business_basic,instagram_business_content_publish";

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Authentication management");

  auth
    .command("setup")
    .description("Interactive guided authentication setup")
    .action(async () => {
      console.log(chalk.bold("\n🔐 Instagram CLI Authentication Setup\n"));

      const appId = readlineSync.question("Enter your Meta App ID: ");
      const appSecret = readlineSync.question("Enter your Meta App Secret: ", {
        mask: "*",
      });

      if (!appId || !appSecret) {
        error("App ID and App Secret are required.");
      }

      const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${SCOPES}`;

      console.log(`\n${chalk.bold("Step 1:")} Open this URL in your browser:\n`);
      console.log(chalk.underline(authUrl));
      console.log(
        `\n${chalk.bold("Step 2:")} After authorizing, you'll be redirected to a localhost URL.`
      );
      console.log("Copy the ?code=... value from the URL.\n");

      const code = readlineSync.question("Paste the authorization code: ");
      if (!code) {
        error("Authorization code is required.");
      }

      info("\nExchanging code for short-lived token...");
      const shortLived = await exchangeCodeForToken(
        appId,
        appSecret,
        code,
        REDIRECT_URI
      );

      info("Exchanging for long-lived token...");
      const longLived = await exchangeForLongLivedToken(
        appSecret,
        shortLived.access_token
      );

      const expiresAt = new Date(
        Date.now() + longLived.expires_in * 1000
      ).toISOString();

      info("Fetching account info...");
      const tempConfig: Config = {
        app_id: appId,
        app_secret: appSecret,
        access_token: longLived.access_token,
        ig_user_id: "",
        token_expires_at: expiresAt,
      };

      // Use the long-lived token to get user info
      const me = await getMe(tempConfig, "user_id,username");

      const config: Config = {
        app_id: appId,
        app_secret: appSecret,
        access_token: longLived.access_token,
        ig_user_id: me.user_id,
        token_expires_at: expiresAt,
      };

      saveConfig(config);
      success(`\nAuthenticated as @${me.username} (${me.user_id})`);
      success("Config saved to ~/.instacli/config.json");
    });

  auth
    .command("token")
    .description("Manually set a token (from Meta Developer Console)")
    .action(async () => {
      console.log(chalk.bold("\n🔑 Manual Token Setup\n"));
      console.log("Generate a token in the Meta Developer Console:");
      console.log("Instagram API with Instagram Login → Generate token\n");

      const appId = readlineSync.question("Enter your Instagram App ID: ");
      const appSecret = readlineSync.question("Enter your Instagram App Secret: ", { mask: "*" });
      const token = readlineSync.question("Paste the generated token: ");

      if (!appId || !appSecret || !token) {
        error("All fields are required.");
      }

      info("\nFetching account info...");
      const tempConfig: Config = {
        app_id: appId,
        app_secret: appSecret,
        access_token: token,
        ig_user_id: "",
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };

      try {
        const me = await getMe(tempConfig, "user_id,username");

        // Try to exchange for long-lived token
        info("Exchanging for long-lived token...");
        try {
          const longLived = await exchangeForLongLivedToken(appSecret, token);
          const expiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString();
          tempConfig.access_token = longLived.access_token;
          tempConfig.token_expires_at = expiresAt;
          success("Got long-lived token (60 days)!");
        } catch {
          info("Could not exchange for long-lived token. Using provided token as-is.");
        }

        tempConfig.ig_user_id = me.user_id;
        saveConfig(tempConfig);
        success(`\nAuthenticated as @${me.username} (${me.user_id})`);
        success("Config saved to ~/.instacli/config.json");
      } catch (e: any) {
        error(`Failed to verify token: ${e.message}`);
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(async () => {
      if (!configExists()) {
        error("Not configured. Run `instacli auth setup` first.");
      }

      const config = loadConfig();

      try {
        const me = await getMe(config, "user_id,username");
        const days = daysUntil(config.token_expires_at);

        console.log(chalk.bold("\nAuth Status"));
        console.log(`  Username:     @${me.username}`);
        console.log(`  User ID:      ${config.ig_user_id}`);
        console.log(`  Token Expiry: ${formatDate(config.token_expires_at)}`);
        console.log(
          `  Days Left:    ${days > 7 ? chalk.green(days) : days > 0 ? chalk.yellow(days) : chalk.red(days)}`
        );
        console.log();
      } catch (e: any) {
        error(`Token may be expired: ${e.message}`);
      }
    });

  auth
    .command("refresh")
    .description("Refresh the long-lived token (extends 60 days)")
    .action(async () => {
      if (!configExists()) {
        error("Not configured. Run `instacli auth setup` first.");
      }

      const config = loadConfig();
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
