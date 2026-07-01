export interface Message {
  senderName: string
  senderEmail: string
  date: string
  toText: string
  body: string
}

export interface Attachment {
  name: string
  /** Download URL if Gmail exposed one, else "". */
  url: string
}

export interface Thread {
  subject: string
  messages: Message[]
  attachments: Attachment[]
}

export type OutputFormat = "markdown" | "text" | "json"

export interface OutputOptions {
  format: OutputFormat
  /** 0 = all messages, otherwise keep only the last N. */
  count: number
  includeAttachments: boolean
  /** Strip body lines containing any of these (case-insensitive substring). */
  boilerplate: string[]
}
