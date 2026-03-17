import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  createMediaContainer,
  pollContainerStatus,
  publishMedia,
} from "../lib/api";
import { loadConfig } from "../lib/config";
import { uploadToFileIo } from "../lib/upload";
import { error } from "../lib/utils";

export function registerStoryCommands(program: Command): void {
  const story = program.command("story").description("Post Instagram stories");

  story
    .command("photo <file>")
    .description("Post a photo story")
    .action(async (file: string) => {
      const config = loadConfig();

      const spinner = ora("Uploading file...").start();
      let publicUrl: string;
      try {
        publicUrl = await uploadToFileIo(file);
        spinner.succeed("File uploaded");
      } catch (e: any) {
        spinner.fail("Upload failed");
        error(e.message);
      }

      spinner.start("Creating story container...");
      const container = await createMediaContainer(config, {
        image_url: publicUrl,
        media_type: "STORIES",
      });
      spinner.succeed(`Container created: ${container.id}`);

      spinner.start("Waiting for processing...");
      await pollContainerStatus(config, container.id);
      spinner.succeed("Processing complete");

      spinner.start("Publishing story...");
      const published = await publishMedia(config, container.id);
      spinner.succeed("Story published!");

      console.log(`\n  ${chalk.bold("Media ID:")}  ${published.id}\n`);
    });

  story
    .command("video <file>")
    .description("Post a video story")
    .action(async (file: string) => {
      const config = loadConfig();

      const spinner = ora("Uploading video...").start();
      let publicUrl: string;
      try {
        publicUrl = await uploadToFileIo(file);
        spinner.succeed("Video uploaded");
      } catch (e: any) {
        spinner.fail("Upload failed");
        error(e.message);
      }

      spinner.start("Creating story container...");
      const container = await createMediaContainer(config, {
        video_url: publicUrl,
        media_type: "STORIES",
      });
      spinner.succeed(`Container created: ${container.id}`);

      spinner.start("Waiting for video processing...");
      await pollContainerStatus(config, container.id, 5000, 120000);
      spinner.succeed("Processing complete");

      spinner.start("Publishing story...");
      const published = await publishMedia(config, container.id);
      spinner.succeed("Story published!");

      console.log(`\n  ${chalk.bold("Media ID:")}  ${published.id}\n`);
    });
}
