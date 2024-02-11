import debug from "debug";
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { config } from "dotenv";
import { handle } from "./handle";

config();

const log = debug("client");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Message, Partials.Channel],
});

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) {
		return;
	}

	await handle(message.client, Events.MessageCreate, "message", message, async (err) => {
		log("error", err);
		await message.reply(
			"I'm sorry, It seems that I have encountered an error while processing your request.",
		);
	});
});

client.on(Events.GuildCreate, async (guild) => {
	await handle(guild.client, Events.GuildCreate, "guild", guild);
});

client.on(Events.GuildMemberAdd, async (member) => {
	await handle(member.client, Events.GuildMemberAdd, "member", member);
});

client.on(Events.InteractionCreate, async (interaction) => {
	await handle(
		interaction.client,
		Events.InteractionCreate,
		"interaction",
		interaction,
		async (err) => {
			log("error", err);
			if (interaction.isCommand()) {
				await interaction[interaction.replied ? "followUp" : "reply"](
					"I'm sorry, It seems that I have encountered an error while processing your request.",
				);
			}
		},
	);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	if (oldMessage.author?.bot) {
		return;
	}

	await handle(
		oldMessage.client,
		Events.MessageUpdate,
		"{oldMessage, newMessage}",
		{ oldMessage, newMessage },
		async (err) => {
			log("error", err);
			await oldMessage.reply(
				"I'm sorry, It seems that I have encountered an error while processing your request.",
			);
		},
	);
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
	await handle(
		reaction.client,
		Events.MessageReactionAdd,
		"{reaction, user}",
		{ reaction, user },
		async (err) => {
			log("error", err);
			await reaction.message.reply(
				"I'm sorry, It seems that I have encountered an error while processing your request.",
			);
		},
	);
});

client.login(process.env.BOT_TOKEN);

process.on("message", (message: { type: string; data: unknown }) => {
	if (!message.type) {
		return;
	}

	if (message.type == "ready") {
		if (message.data && typeof message.data === "object" && "id" in message.data) {
			log.namespace = "client:" + message.data.id;
			log(`Shard ${message.data.id} is ready`, client.user);
		}
	}
});
