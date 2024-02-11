import debug from "debug";
import type { Client } from "discord.js";
import { config } from "dotenv";
import vm from "node:vm";
import type { OpenAI } from "openai";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { openai } from "./openai";

config();

const log = debug("handle");

const SYSTEM_MESSAGE = (
	c: Client<true>,
	event: string,
) => `You are now operating as a fully autonomous Discord bot named "${c.user.displayName}" (ID: ${c.user.id}). Your mission is to process incoming "${event}" event, and determine the best course of action. You should:
- Understand and analyze the content of the event, provided in the user message.
- Make decisions based on the event content. This could range from simple acknowledgements to executing complex tasks.
- Respond appropriately and efficiently. For urgent matters, provide an initial quick response, followed by more detailed follow-up if necessary.
- Use external data and services when required, prioritizing those that do not need an API key for access.
- Maintain a friendly and helpful demeanor, only taking action when it's clear your assistance is needed.
- You can change the behavior of the bot client by modifying the code.
Remember, your goal is to assist and facilitate, not to overwhelm or unnecessarily engage.`;

const TOOLS = (param: string): OpenAI.Chat.Completions.ChatCompletionTool[] => [
	{
		type: "function",
		function: {
			name: "handle",
			description: `This tool is designed to process the incoming event by executing a JavaScript code snippet using Discord.js. When you choose to 'handle' an event, you are expected to define a complete JavaScript callback function that interacts with the Discord.js client. This function should be capable of performing a variety of tasks such as fetching data, setting timers, listing channels, sending reactions, replying to messages, etc., all while maintaining an efficient and user-friendly interaction pattern. Ensure your implementation is concise, avoids unnecessary comments, and leverages ES6+ features for optimal performance and readability. Don't use regex to match message.`,
			parameters: zodToJsonSchema(
				z.object({
					code: z
						.string()
						.describe(
							`A complete JavaScript callback function that interacts with the Discord.js client. The code should follow the structure: async (${param}) => { <function body> }, where '${param}' represents the event details.`,
						),
				}),
			),
		},
	},
	{
		type: "function",
		function: {
			name: "nothing",
			description: "Decide to do nothing with the event, just ignore it",
		},
	},
];

export async function handle(
	client: Client<true>,
	event: string,
	param: string,
	arg: unknown,
	error_handler: (err: Error) => void = log,
) {
	log(event, arg);

	const moderation = await moderate(JSON.stringify(arg, null, 2));
	if (moderation.flagged) {
		error_handler(
			new Error("The input content is not allowed. " + JSON.stringify(moderation.categories)),
		);
		return;
	}

	const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
		{
			role: "system",
			content: SYSTEM_MESSAGE(client, event),
		},
		{
			role: "user",
			content: JSON.stringify(arg, null, 2),
		},
	];

	const res = await openai.chat.completions.create({
		// "gpt-3.5-turbo-0125", "gpt-4-0125-preview", ...
		model: process.env.OPENAI_MODEL || "gpt-4-0125-preview",
		temperature: 0.3,
		seed: 20030317,
		max_tokens: 512,
		messages,
		tools: TOOLS(param),
		tool_choice: "auto",
	});
	log("response", res.choices[0].message);

	for (const func of res.choices[0].message.tool_calls || []) {
		if (func.function.name === "handle") {
			const args = JSON.parse(func.function.arguments);
			log("handle", args);
			try {
				let code = args.code;
				if (!code.startsWith("async")) {
					code = `async (${param}) => { ${code} }`;
				}
				const script = new vm.Script(
					`(${code})(${param}).catch(ERROR_HANDLER).then(COMPLETE)`,
				);
				const context = vm.createContext({
					...global,
					[param]: arg,
					ERROR_HANDLER: error_handler,
					COMPLETE: () => {},
				});
				script.runInContext(context, { timeout: 30_000 });
			} catch (err) {
				log("handle error", err);
			}
		} else if (func.function.name === "nothing") {
			log("I decided to do nothing with the event, ignore");
		}
	}
}

async function moderate(content: string): Promise<OpenAI.Moderations.Moderation> {
	const moderation = await openai.moderations.create({ input: content });
	return moderation.results[0];
}
