import { Command } from "commander";
import chalk from "chalk";
import { getMe } from "../lib/api";
import { loadConfig } from "../lib/config";

export function registerMeCommand(program: Command): void {
  program
    .command("me")
    .description("Show account info")
    .option("--json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const config = loadConfig();
      const me = await getMe(config);

      if (options.json) {
        console.log(JSON.stringify(me, null, 2));
        return;
      }

      console.log(chalk.bold("\nAccount Info"));
      console.log(`  Username:   @${me.username || "-"}`);
      console.log(`  Name:       ${me.name || "-"}`);
      console.log(`  User ID:    ${me.user_id || "-"}`);
      console.log(`  Type:       ${me.account_type || "-"}`);
      console.log(`  Posts:      ${me.media_count ?? "-"}`);
      console.log(`  Followers:  ${me.followers_count ?? "-"}`);
      console.log(`  Following:  ${me.follows_count ?? "-"}`);
      console.log();
    });
}
