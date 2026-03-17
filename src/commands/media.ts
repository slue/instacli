import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { listMedia, getMediaInfo, deleteMedia } from "../lib/api";
import { loadConfig } from "../lib/config";
import { truncate, formatDate } from "../lib/utils";

export function registerMediaCommands(program: Command): void {
  const media = program.command("media").description("Manage media");

  media
    .command("ls")
    .description("List recent media")
    .option("-l, --limit <number>", "Number of items", "10")
    .option("--json", "Output as JSON")
    .action(async (options: { limit: string; json?: boolean }) => {
      const config = loadConfig();
      const result = await listMedia(config, parseInt(options.limit, 10));

      if (options.json) {
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }

      if (!result.data || result.data.length === 0) {
        console.log("No media found.");
        return;
      }

      const table = new Table({
        head: [
          chalk.bold("ID"),
          chalk.bold("Type"),
          chalk.bold("Caption"),
          chalk.bold("Likes"),
          chalk.bold("Comments"),
          chalk.bold("Date"),
        ],
      });

      for (const item of result.data) {
        table.push([
          item.id,
          item.media_type || "",
          truncate(item.caption, 30),
          item.like_count ?? "-",
          item.comments_count ?? "-",
          item.timestamp ? formatDate(item.timestamp) : "",
        ]);
      }

      console.log(table.toString());
    });

  media
    .command("info <id>")
    .description("Get detailed info about a media item")
    .option("--json", "Output as JSON")
    .action(async (id: string, options: { json?: boolean }) => {
      const config = loadConfig();
      const info = await getMediaInfo(config, id);

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      console.log(chalk.bold("\nMedia Info"));
      console.log(`  ID:         ${info.id}`);
      console.log(`  Type:       ${info.media_type || "-"}`);
      console.log(`  Caption:    ${info.caption || "-"}`);
      console.log(`  Permalink:  ${info.permalink || "-"}`);
      console.log(`  Media URL:  ${info.media_url || "-"}`);
      console.log(`  Likes:      ${info.like_count ?? "-"}`);
      console.log(`  Comments:   ${info.comments_count ?? "-"}`);
      console.log(`  Posted:     ${info.timestamp ? formatDate(info.timestamp) : "-"}`);
      console.log();
    });

  media
    .command("delete <id>")
    .description("Delete a media item")
    .action(async (id: string) => {
      const config = loadConfig();
      await deleteMedia(config, id);
      console.log(chalk.green(`Media ${id} deleted.`));
    });
}
