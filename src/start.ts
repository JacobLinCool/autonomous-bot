import debug from "debug";
import { ShardingManager } from "discord.js";
import { config } from "dotenv";

config();

const log = debug("cluster");

const CLIENT = new URL(import.meta.url).pathname.replace(/\/[^/]+$/, "/client.js");
log("Client path:", CLIENT);

const manager = new ShardingManager(CLIENT, { token: process.env.BOT_TOKEN });

manager.on("shardCreate", (shard) => {
	log(`Shard ${shard.id} launched`);

	shard.on("ready", () => {
		shard.send({ type: "ready", data: { id: shard.id } });
	});
});

manager.spawn();
