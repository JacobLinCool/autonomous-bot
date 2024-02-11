import debug from "debug";
import { config } from "dotenv";
import { OpenAI } from "openai";

config();

const log = debug("openai");

export const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	baseURL: process.env.OPENAI_API_URL,
	fetch: async (...args) => {
		log("fetch", args);
		return fetch(...args)
			.then(async (res) => {
				log("fetch ok", await res.clone().json());
				return res;
			})
			.catch((err) => {
				log("fetch err", err);
				throw err;
			});
	},
});
