// Type declarations for imapflow (no official types available)
declare module 'imapflow' {
  export class ImapFlow {
    constructor(options: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
      logger?: boolean;
    });

    connect(): Promise<void>;
    logout(): Promise<void>;
    mailboxOpen(path: string): Promise<any>;
    search(criteria: any): Promise<any>;
    fetch(range: string | number[], options: any): AsyncIterable<any>;
    getMailboxLock(path: string): Promise<any>;
  }
}

declare module 'mailparser' {
  export function simpleParser(source: any): Promise<{
    text?: string;
    html?: string;
    subject?: string;
    from?: { value: Array<{ address: string; name?: string }> };
    to?: { value: Array<{ address: string; name?: string }> };
    cc?: { value: Array<{ address: string; name?: string }> };
    date?: Date;
    messageId?: string;
    inReplyTo?: string;
    references?: string[];
    attachments?: Array<{
      filename: string;
      contentType: string;
      size: number;
      content?: Buffer;
    }>;
  }>;
}
