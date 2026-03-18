import { Command } from "commander";
import { loadConfig } from "../lib/config";
import { getConversations, getMessages, sendMessage } from "../lib/api";

export function registerDmCommands(program: Command): void {
  const dm = program.command("dm").description("Instagram Direct Messages");

  dm.command("inbox")
    .alias("conversations")
    .description("List recent DM conversations")
    .option("-l, --limit <n>", "Number of conversations", "20")
    .action(async (opts) => {
      const config = loadConfig();
      const data = await getConversations(config, parseInt(opts.limit));
      for (const conv of data.data || []) {
        const lastMsg = conv.messages?.data?.[0];
        console.log(
          `${conv.id}\t${lastMsg?.timestamp || ""}\t${lastMsg?.from?.username || ""}\t${lastMsg?.message || ""}`
        );
      }
    });

  dm.command("read <conversationId>")
    .description("Read messages in a conversation")
    .action(async (conversationId) => {
      const config = loadConfig();
      const data = await getMessages(config, conversationId);
      for (const msg of (data.messages?.data || []).reverse()) {
        console.log(
          `${msg.timestamp}\t${msg.from?.username || msg.from?.id || ""}\t${msg.message || ""}`
        );
      }
    });

  dm.command("send <recipientId> <message>")
    .description("Send a DM")
    .action(async (recipientId, message) => {
      const config = loadConfig();
      const result = await sendMessage(config, recipientId, message);
      console.log(`Sent: ${result.message_id || result.id || "OK"}`);
    });
}
