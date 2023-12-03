import { basename } from "node:path";
import * as pm2 from "pm2";
import { Mailer, type MailerConfig } from "./mailer";

import { exit } from "./utils";
import type { Attachment } from "nodemailer/lib/mailer";

enum Events {
  Restart = "restart",
  Delete = "delete",
  Stop = "stop",
  RestartLimit = "restart overlimit",
  Exit = "exit",
  Start = "start",
  Online = "online",
}

export interface MonitorConfig extends MailerConfig {
  apps: string[];
  events: Array<Events>;
}

interface EventData {
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
}

export class Monitor {
  private mailer: Mailer;

  constructor(private config: MonitorConfig) {
    this.mailer = new Mailer(this.config);
  }

  public start() {
    pm2.connect((err) => {
      exit(err);

      pm2.launchBus((err, bus) => {
        exit(err);

        const { events, mailer } = this.config;

        bus.on("process:event", (data: EventData) => {
          console.log("process:event", data);
          const { manually, event, process } = data;

          if (manually || !this.includedApp(process.name)) return;

          if (Array.isArray(events) && events.indexOf(event) === -1) return;

          const { name, pm_id, pm_out_log_path, pm_err_log_path } = process;
          let attachments: Attachment[];

          if (mailer.withLogs === true) {
            attachments = [
              { filename: basename(pm_out_log_path), path: pm_out_log_path },
              { filename: basename(pm_err_log_path), path: pm_err_log_path },
            ];
          }

          this.mailer.send({
            subject: `${name}(${pm_id}): ${event}`,
            body: `
              <p>App: <b>${name}</b>  pm_id: <b>${pm_id}</b></p>
              <p>Event: <b>${event}</b></p>
              <pre>${JSON.stringify(data, undefined, 4)}</pre>
            `,
            priority: "high",
            attachments,
          });
        });

        bus.on("process:exceptions", (data) => {
          console.log("process:exceptions", data);
        });

        bus.on("process:msg", (data) => {
          console.log("process:msg", data);
        });
      });
    });
  }

  private includedApp(app: string): boolean {
    if (app === "pm2-monitor-server" || app === "pm2-monitor-app") return false;

    const { apps } = this.config;
    if (Array.isArray(apps)) {
      return apps.includes(app);
    }

    return false;
  }
}
