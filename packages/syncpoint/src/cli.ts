import { run } from "./core/cli.js";

run().catch((error: Error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
