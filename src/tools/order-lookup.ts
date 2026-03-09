import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const MOCK_ORDERS: Record<string, { status: string; items: string[]; estimatedDelivery: string }> = {
  "ORD-001": { status: "shipped", items: ["Wireless Headphones"], estimatedDelivery: "2026-03-12" },
  "ORD-002": { status: "processing", items: ["USB-C Hub", "HDMI Cable"], estimatedDelivery: "2026-03-15" },
  "ORD-003": { status: "delivered", items: ["Mechanical Keyboard"], estimatedDelivery: "2026-03-08" },
  "ORD-004": { status: "cancelled", items: ["Laptop Stand"], estimatedDelivery: "N/A" },
};

export const orderLookupTool = new DynamicStructuredTool({
  name: "orderLookup",
  description: "Look up the status and details of a customer order by order ID. Use this when a customer asks about their order status, delivery, or order details.",
  schema: z.object({
    orderId: z.string().describe("The order ID to look up, e.g. ORD-001"),
  }),
  func: async ({ orderId }) => {
    const order = MOCK_ORDERS[orderId.toUpperCase()];
    if (!order) {
      return JSON.stringify({ error: `Order ${orderId} not found. Valid order IDs: ${Object.keys(MOCK_ORDERS).join(", ")}` });
    }
    return JSON.stringify({ orderId: orderId.toUpperCase(), ...order });
  },
});
