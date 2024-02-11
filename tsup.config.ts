import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/start.ts", "src/client.ts"],
	format: ["esm"],
	clean: true,
	splitting: false,
	bundle: true,
});
