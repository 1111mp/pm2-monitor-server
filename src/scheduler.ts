import { basename } from "node:path";
import { Mailer, type MailerConfig, type MailerMessage } from "./mailer";
import type { Attachment } from "nodemailer/lib/mailer";

enum Events {
  Restart = "restart",
  Delete = "delete",
  Stop = "stop",
  RestartLimit = "restart overlimit",
  Exit = "exit",
  Start = "start",
  Online = "online",

  // custom
  Exception = "exception",
}

export enum Tasks {
  Event = "event",
  Exception = "exception",
}

export interface MonitorConfig extends MailerConfig {
  apps: string[];
  events: Array<Events>;
  debounce: number; // second
}

export interface EventData {
  manually: boolean;
  event: Events;
  at: number;
  process: {
    name: string;
    pm_id: number;
    pm_exec_path: string;
    pm_cwd: string;
    pm_out_log_path: string;
    pm_err_log_path: string;
    status: string;
    [key: string]: any;
  };
  data: unknown;
}

interface TaskData {
  data: EventData;
  times: number;
  firstTimer: NodeJS.Timeout;
  timer: NodeJS.Timeout;
}

export class Scheduler {
  private mailer: Mailer;

  private cache: Map<string, TaskData>;

  constructor(private config: MonitorConfig) {
    if (this.config.debounce < 5) {
      this.config.debounce = 5;
    }

    this.mailer = new Mailer(this.config);
  }

  public task(data: EventData, type: Tasks) {
    const { name, pm_id } = data.process;
    const key = `${type}-${name}-${pm_id}`;

    if (this.cache.has(key)) {
      const current = this.cache.get(key);
      current.times += 1;
      current.data = data;
      if (!current.firstTimer) {
        clearTimeout(current.timer);
        current.timer = null;
        current.timer = setTimeout(() => {
          this.trigger(key);
        }, this.config.debounce * 1000);
      }
    } else {
      this.cache.set(key, {
        times: 1,
        data: data,
        firstTimer: setTimeout(() => {
          // Trigger the alert first time
          this.trigger(key, true);
        }, 300),
        timer: setTimeout(() => {
          this.cache.delete(key);
        }, this.config.debounce * 1000),
      });
    }
  }

  private async trigger(key: string, first: boolean = false) {
    console.log(key);
    const { mailer } = this.config;
    const { times, data } = this.cache.get(key);
    const { name, pm_id, pm_out_log_path, pm_err_log_path } = data.process;

    let attachments: Attachment[];
    if (mailer.withLogs === true) {
      attachments = [
        { filename: basename(pm_out_log_path), path: pm_out_log_path },
        { filename: basename(pm_err_log_path), path: pm_err_log_path },
      ];
    }

    const isException = key.startsWith("exception");
    isException && (data.event = Events.Exception);

    await this.mailer.send({
      subject: `${name}-${pm_id}: ${data.event}`,
      body: `
              <p>App: <b>${name}</b>  pm_id: <b>${pm_id}</b></p>
              <p>Event: <b>${data.event}</b>  Trigger Times: <b>${times}</b></p>
              <pre>${JSON.stringify(
                isException ? data.data : data,
                undefined,
                4
              )}</pre>
            `,
      priority: "high",
      attachments,
    });

    if (!first) {
      this.cache.delete(key);
      return;
    }

    const current = this.cache.get(key);
    current.times = 0;
    current.firstTimer = null;
    return;
  }
}
