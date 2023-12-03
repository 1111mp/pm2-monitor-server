import * as pmx from "pmx";
import { Monitor, type MonitorConfig } from "./monitor";

import { exit } from "./utils";

pmx.initModule(
  {
    widget: {
      el: {
        probes: false,
        actions: true,
      },
      block: {
        actions: true,
        issues: true,
        meta: true,
        cpu: true,
        mem: true,
      },
    },
  },
  (err, config: MonitorConfig) => {
    exit(err);

    console.log(config);

    const monitor = new Monitor(config);
    monitor.start();
  }
);
