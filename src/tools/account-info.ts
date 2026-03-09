import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const MOCK_ACCOUNTS: Record<string, { name: string; email: string; tier: string; since: string; recentOrders: string[] }> = {
  "CUST-100": { name: "Alice Johnson", email: "alice@example.com", tier: "Gold", since: "2023-01-15", recentOrders: ["ORD-001", "ORD-003"] },
  "CUST-200": { name: "Bob Smith", email: "bob@example.com", tier: "Silver", since: "2024-06-20", recentOrders: ["ORD-002"] },
  "CUST-300": { name: "Carol Davis", email: "carol@example.com", tier: "Platinum", since: "2022-03-10", recentOrders: ["ORD-001", "ORD-002", "ORD-004"] },
};

export const accountInfoTool = new DynamicStructuredTool({
  name: "accountInfo",
  description: "Retrieve customer account information including name, membership tier, and recent orders. Use when the customer asks about their account or you need to identify them.",
  schema: z.object({
    customerId: z.string().describe("The customer ID to look up, e.g. CUST-100"),
  }),
  func: async ({ customerId }) => {
    const account = MOCK_ACCOUNTS[customerId.toUpperCase()];
    if (!account) {
      return JSON.stringify({ error: `Customer ${customerId} not found. Valid IDs: ${Object.keys(MOCK_ACCOUNTS).join(", ")}` });
    }
    return JSON.stringify({ customerId: customerId.toUpperCase(), ...account });
  },
});
