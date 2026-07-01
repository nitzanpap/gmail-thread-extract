import type { Message, OutputOptions, Thread } from "../types"
import { toMarkdown } from "./markdown"

/** Keep only the last `count` messages (0 or negative = keep all). */
export function selectMessages(messages: Message[], count: number): Message[] {
  return count > 0 ? messages.slice(-count) : messages
}

/** Drop body lines that contain any boilerplate phrase (case-insensitive). */
export function applyBoilerplate(body: string, phrases: string[]): string {
  if (phrases.length === 0) {
    return body
  }
  const needles = phrases.map(p => p.toLowerCase())
  return body
    .split("\n")
    .filter(line => {
      const lower = line.toLowerCase()
      return !needles.some(n => lower.includes(n))
    })
    .join("\n")
    .trim()
}

/** Apply range + boilerplate + attachment options to produce a filtered thread. */
function prepare(thread: Thread, opts: OutputOptions): Thread {
  const messages = selectMessages(thread.messages, opts.count).map(m => ({
    ...m,
    body: applyBoilerplate(m.body, opts.boilerplate)
  }))
  return {
    subject: thread.subject,
    messages,
    attachments: opts.includeAttachments ? thread.attachments : []
  }
}

function toText(thread: Thread, extractedAt: string): string {
  const divider = "-".repeat(40)
  const blocks = thread.messages.map((m, i) => {
    const from = m.senderEmail
      ? `${m.senderName || m.senderEmail} <${m.senderEmail}>`
      : m.senderName || "Unknown"
    return [
      `Message ${i + 1}`,
      `From: ${from}`,
      m.toText ? `To / Details: ${m.toText}` : null,
      m.date ? `Date: ${m.date}` : null,
      "",
      m.body,
      "",
      divider
    ]
      .filter((line): line is string => line !== null)
      .join("\n")
  })

  const lines = [
    "Gmail Thread",
    `Subject: ${thread.subject}`,
    `Extracted at: ${extractedAt}`,
    `Messages found: ${thread.messages.length}`,
    divider,
    "",
    blocks.join("\n\n")
  ]
  if (thread.attachments.length > 0) {
    lines.push(
      "",
      "Attachments:",
      ...thread.attachments.map(a => (a.url ? `- ${a.name} (${a.url})` : `- ${a.name}`))
    )
  }
  return lines.join("\n").trim()
}

function toJson(thread: Thread, extractedAt: string): string {
  return JSON.stringify(
    {
      subject: thread.subject,
      extractedAt,
      messageCount: thread.messages.length,
      messages: thread.messages.map(m => ({
        from: { name: m.senderName, email: m.senderEmail },
        to: m.toText,
        date: m.date,
        body: m.body
      })),
      attachments: thread.attachments
    },
    null,
    2
  )
}

const EXT: Record<OutputOptions["format"], string> = {
  markdown: "md",
  text: "txt",
  json: "json"
}

/** Serialize a thread to the chosen format. Returns the content and file extension. */
export function serialize(
  thread: Thread,
  opts: OutputOptions,
  extractedAt: string
): { content: string; ext: string } {
  const t = prepare(thread, opts)
  const content =
    opts.format === "text"
      ? toText(t, extractedAt)
      : opts.format === "json"
        ? toJson(t, extractedAt)
        : toMarkdown(t.subject, t.messages, extractedAt, t.attachments)
  return { content, ext: EXT[opts.format] }
}
