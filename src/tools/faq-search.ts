import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const FAQ_ENTRIES = [
  { question: "What is the return policy?", answer: "You can return any item within 30 days of delivery for a full refund. Items must be in original packaging." },
  { question: "How long does shipping take?", answer: "Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days for an additional $9.99." },
  { question: "How do I track my order?", answer: "Use the orderLookup tool with your order ID (e.g., ORD-001) to check the current status and estimated delivery date." },
  { question: "What payment methods are accepted?", answer: "We accept Visa, Mastercard, American Express, PayPal, and Apple Pay." },
  { question: "How do I contact support?", answer: "You can reach us via this chat, email at support@example.com, or call 1-800-EXAMPLE during business hours (9am-6pm EST)." },
  { question: "Do you offer international shipping?", answer: "Yes, we ship to over 50 countries. International shipping takes 7-14 business days." },
];

export const faqSearchTool = new DynamicStructuredTool({
  name: "faqSearch",
  description: "Search the FAQ knowledge base for answers to common customer questions about policies, shipping, returns, payments, etc.",
  schema: z.object({
    query: z.string().describe("The search query to find relevant FAQ entries"),
  }),
  func: async ({ query }) => {
    const queryLower = query.toLowerCase();
    const matches = FAQ_ENTRIES.filter(
      (faq) =>
        faq.question.toLowerCase().includes(queryLower) ||
        faq.answer.toLowerCase().includes(queryLower) ||
        queryLower.split(" ").some((word) => word.length > 3 && faq.question.toLowerCase().includes(word))
    );

    if (matches.length === 0) {
      return JSON.stringify({ results: [], message: "No FAQ entries matched your query." });
    }
    return JSON.stringify({ results: matches.slice(0, 3) });
  },
});
