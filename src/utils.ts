import * as pm2 from "pm2";

export const exit = (err?: Error) => {
  if (err) {
    console.log(err);
    pm2.disconnect();
    process.exit(1);
  }
};
