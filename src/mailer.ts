import { hostname } from "node:os";
import { readFileSync } from "node:fs";
import { createTransport, type Transporter } from "nodemailer";

import type { Attachment } from "nodemailer/lib/mailer";
import type { SentMessageInfo } from "nodemailer/lib/smtp-transport";

export interface MailerConfig {
  name: string;
  url: string;
  smtp: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    /** optional hostname of the client, used for identifying to the server */
    hostname?: string;
  };
  mailer: {
    from?: "";
    to: string;
    replyTo: string;
    withLogs: boolean;
  };
  mailDisabled: boolean;
}

interface MailerMessage {
  subject: string;
  body: string;
  priority: "high" | "normal" | "low";
  attachments?: Attachment[];
}

export class Mailer {
  private transport: Transporter<SentMessageInfo>;
  private template: string = `<div><!-- body --></div><hr /><small><a href="%url%">%name%</a> <i><!-- timeStamp --></i></small>`;

  constructor(private config: MailerConfig) {
    const { smtp } = config;

    !smtp && (this.config.mailDisabled = true);

    if (this.config.mailDisabled) return;

    if (!smtp.host) {
      throw new Error("The host option of the SMTP server must be provided");
    }

    if (!smtp.port) {
      throw new Error("The port option of the SMTP server must be provided");
    }

    try {
      this.template = readFileSync("template.html", "utf8");
    } catch (err) {
      console.log("template.html not found");
    }

    this.transport = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure === true,
      auth: smtp.user
        ? {
            user: smtp.user,
            pass: smtp.password,
          }
        : undefined,
      name: smtp.hostname,
    });
  }

  public async send(message: MailerMessage) {
    const { name, url, mailer, smtp } = this.config;
    const { subject, body, priority, attachments } = message;

    const info = await this.transport.sendMail({
      from: mailer.from || smtp.user,
      to: mailer.to,
      replyTo: mailer.replyTo,
      subject: `[pm2-moniter-server ${hostname()}]: ${subject}`,
      html: this.template
        .replace(/<!--\s*body\s*-->/, body)
        .replace(/%name%/, name)
        .replace(/%url%/, url)
        .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
      attachments,
      priority,
      headers: {
        importance: priority,
      },
    });

    const { rejected } = info;
    if (rejected && rejected.length) {
      console.log(
        `A total of ${
          rejected.length
        } emails failed to be sent, they are <${rejected.join(", ")}>`
      );
    }

    return info;
  }
}
