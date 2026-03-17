#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth";
import { registerPostCommands } from "./commands/post";
import { registerStoryCommands } from "./commands/story";
import { registerMediaCommands } from "./commands/media";
import { registerMeCommand } from "./commands/me";

const program = new Command();

program
  .name("instacli")
  .description("Instagram CLI using the Meta Graph API")
  .version("1.0.0");

registerAuthCommands(program);
registerPostCommands(program);
registerStoryCommands(program);
registerMediaCommands(program);
registerMeCommand(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
