import { createServer } from "./server.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createServer(config);

app.listen(config.port, () => {
  console.log(`Stellar PayGate MCP API listening on http://localhost:${config.port}`);
});
