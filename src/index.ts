import { Unleash } from "unleash-client";
import winston, { Logger } from "winston";
import { SafeLogger } from "./safeLogger";

export const getInstance = (config: {
  unleash: Unleash;
  flagName: string;
  baseUrl: string;
  globalLogLevelKey: string;
  defaultVariantName: string;
}): winston.Logger => {
  return new SafeLogger(config).logger;
};
