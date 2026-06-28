import type { Message } from "../types"

/** Sanitize a thread subject into a safe download filename. */
export function safeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\p{Cc}]/gu, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "gmail-thread"
  )
}

function messageBlock(msg: Message, index: number): string[] {
  const from = msg.senderEmail
    ? `${msg.senderName || msg.senderEmail} <${msg.senderEmail}>`
    : msg.senderName || "Unknown"

  return [
    `## Message ${index + 1}`,
    "",
    `**From:** ${from}`,
    msg.toText ? `**To / Details:** ${msg.toText}` : null,
    msg.date ? `**Date:** ${msg.date}` : null,
    "",
    msg.body,
    "",
    "---",
    ""
  ].filter((line): line is string => line !== null)
}

/** Serialize a thread to the Markdown format consumed by an AI agent. */
export function toMarkdown(subject: string, messages: Message[], extractedAt: string): string {
  return [
    "# Gmail Thread",
    "",
    `**Subject:** ${subject}`,
    `**Extracted at:** ${extractedAt}`,
    `**Messages found:** ${messages.length}`,
    "",
    "---",
    "",
    ...messages.flatMap(messageBlock)
  ].join("\n")
}
