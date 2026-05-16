import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PAYGATE_TOOLS, getTool, runPayGateTool, type PayGateToolId } from "@stellar-paygate/shared";

const server = new McpServer({
  name: "stellar-paygate-mcp",
  version: "0.1.0"
});

for (const tool of PAYGATE_TOOLS) {
  server.registerTool(
    tool.id,
    {
      title: tool.name,
      description: `${tool.description} Price: ${tool.priceUsdc} testnet USDC.`,
      inputSchema: {
        prompt: z.string(),
        amount: z.number().optional(),
        region: z.string().optional(),
        asset: z.string().optional(),
        demoPaid: z.boolean().optional(),
        paymentTxHash: z.string().optional()
      }
    },
    async (input) => {
      if (!input.demoPaid && !input.paymentTxHash) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: 402,
                  error: "payment_required",
                  tool: getTool(tool.id),
                  retry: "Pass demoPaid=true or provide a Stellar MPP paymentTxHash."
                },
                null,
                2
              )
            }
          ]
        };
      }

      const result = runPayGateTool(tool.id as PayGateToolId, {
        prompt: input.prompt,
        amount: input.amount,
        region: input.region,
        asset: input.asset
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: 200, tool: getTool(tool.id), result }, null, 2)
          }
        ]
      };
    }
  );
}

await server.connect(new StdioServerTransport());
