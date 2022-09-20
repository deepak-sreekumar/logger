import { SafeLogger } from "./safeLogger";

/**
 * Creates and returns an instance of Safe Logger
 * @returns SafeLogger
 */
export const getInstance = (): SafeLogger => {
  return new SafeLogger();
};
