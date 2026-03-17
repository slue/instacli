import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  createMediaContainer,
  pollContainerStatus,
  publishMedia,
  getMediaInfo,
} from "../lib/api";
import { loadConfig } from "../lib/config";
import { uploadToFileIo } from "../lib/upload";
import { error, success, isVideo } from "../lib/utils";

export function registerPostCommands(program: Command): void {
  const post = program.command("post").description("Publish content to Instagram");

  post
    .command("photo <file>")
    .description("Post a photo")
    .option("-c, --caption <caption>", "Post caption")
    .action(async (file: string, options: { caption?: string }) => {
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

      spinner.start("Creating media container...");
      const params: Record<string, string> = { image_url: publicUrl };
      if (options.caption) params.caption = options.caption;

      const container = await createMediaContainer(config, params);
      spinner.succeed(`Container created: ${container.id}`);

      spinner.start("Waiting for processing...");
      await pollContainerStatus(config, container.id);
      spinner.succeed("Processing complete");

      spinner.start("Publishing...");
      const published = await publishMedia(config, container.id);
      spinner.succeed("Published!");

      const info = await getMediaInfo(config, published.id);
      console.log(`\n  ${chalk.bold("Media ID:")}  ${published.id}`);
      if (info.permalink) {
        console.log(`  ${chalk.bold("Link:")}      ${info.permalink}`);
      }
      console.log();
    });

  post
    .command("carousel <files...>")
    .description("Post a carousel (multiple photos/videos)")
    .option("-c, --caption <caption>", "Post caption")
    .action(async (files: string[], options: { caption?: string }) => {
      if (files.length < 2) {
        error("Carousel requires at least 2 files.");
      }

      const config = loadConfig();

      // Upload all files
      const spinner = ora(`Uploading ${files.length} files...`).start();
      const urls: string[] = [];
      for (const file of files) {
        const url = await uploadToFileIo(file);
        urls.push(url);
      }
      spinner.succeed(`${files.length} files uploaded`);

      // Create item containers
      spinner.start("Creating item containers...");
      const containerIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const params: Record<string, string> = { is_carousel_item: "true" };
        if (isVideo(files[i])) {
          params.media_type = "VIDEO";
          params.video_url = urls[i];
        } else {
          params.image_url = urls[i];
        }
        const container = await createMediaContainer(config, params);
        containerIds.push(container.id);
      }
      spinner.succeed(`${containerIds.length} item containers created`);

      // Wait for all containers
      spinner.start("Waiting for processing...");
      for (const id of containerIds) {
        await pollContainerStatus(config, id);
      }
      spinner.succeed("All items processed");

      // Create carousel container
      spinner.start("Creating carousel...");
      const carouselParams: Record<string, string> = {
        media_type: "CAROUSEL",
        children: containerIds.join(","),
      };
      if (options.caption) carouselParams.caption = options.caption;

      const carousel = await createMediaContainer(config, carouselParams);
      spinner.succeed(`Carousel container created: ${carousel.id}`);

      spinner.start("Publishing carousel...");
      const published = await publishMedia(config, carousel.id);
      spinner.succeed("Carousel published!");

      const mediaInfo = await getMediaInfo(config, published.id);
      console.log(`\n  ${chalk.bold("Media ID:")}  ${published.id}`);
      if (mediaInfo.permalink) {
        console.log(`  ${chalk.bold("Link:")}      ${mediaInfo.permalink}`);
      }
      console.log();
    });

  post
    .command("reel <video>")
    .description("Post a reel")
    .option("-c, --caption <caption>", "Post caption")
    .action(async (video: string, options: { caption?: string }) => {
      const config = loadConfig();

      const spinner = ora("Uploading video...").start();
      const publicUrl = await uploadToFileIo(video);
      spinner.succeed("Video uploaded");

      spinner.start("Creating reel container...");
      const params: Record<string, string> = {
        media_type: "REELS",
        video_url: publicUrl,
        share_to_feed: "true",
      };
      if (options.caption) params.caption = options.caption;

      const container = await createMediaContainer(config, params);
      spinner.succeed(`Container created: ${container.id}`);

      spinner.start("Waiting for video processing (this may take a while)...");
      await pollContainerStatus(config, container.id, 5000, 120000);
      spinner.succeed("Processing complete");

      spinner.start("Publishing reel...");
      const published = await publishMedia(config, container.id);
      spinner.succeed("Reel published!");

      const mediaInfo = await getMediaInfo(config, published.id);
      console.log(`\n  ${chalk.bold("Media ID:")}  ${published.id}`);
      if (mediaInfo.permalink) {
        console.log(`  ${chalk.bold("Link:")}      ${mediaInfo.permalink}`);
      }
      console.log();
    });
}
