import * as pm2 from "pm2";
import {
  Scheduler,
  Tasks,
  type MonitorConfig,
  type EventData,
} from "./scheduler";

import { exit } from "./utils";

export type Config = MonitorConfig;

export class Monitor {
  private scheduler: Scheduler;

  constructor(private config: MonitorConfig) {
    this.scheduler = new Scheduler(this.config);
  }

  public start() {
    pm2.connect((err) => {
      exit(err);

      pm2.launchBus((err, bus) => {
        exit(err);

        const { events } = this.config;

        bus.on("process:event", (data: EventData) => {
          console.log("process:event", data);
          const { manually, event, process } = data;

          if (manually || !this.includedApp(process.name)) return;

          if (Array.isArray(events) && events.indexOf(event) === -1) return;

          this.scheduler.task(data, Tasks.Event);
        });

        bus.on("process:exceptions", (data) => {
          console.log("process:exceptions", data);
          if (!this.includedApp(data.process.name)) return;

          this.scheduler.task(data, Tasks.Exception);
        });

        // bus.on("process:msg", (data) => {
        //   console.log("process:msg", data);
        // });
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
