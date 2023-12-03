import clear from "rollup-plugin-clear";
import typescript from "@rollup/plugin-typescript";

import type { RollupOptions } from "rollup";

const config: RollupOptions[] = [
  {
    input: ["src/app.ts", "src/monitor.ts", "src/mailer.ts", "src/utils.ts"],
    external: [/node_modules/],
    output: {
      dir: "lib",
      format: "cjs",
      strict: false,
      preserveModules: true,
    },
    plugins: [
      clear({
        targets: ["lib"],
      }),
      typescript({
        outDir: "lib",
        /**
         * Rollup requires that TypeScript produces ES Modules
         * https://github.com/rollup/plugins/pull/788
         */
        module: "commonjs",
        exclude: ["rollup.config.ts"],
      }),
    ],
  },
];

export default config;
