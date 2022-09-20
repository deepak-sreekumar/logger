import winston, { config } from "winston";
import { Unleash } from "unleash-client";
import { getUpdatedLogLevel } from "./getUpdatedLogLevel";

const { combine, errors, timestamp, splat, json } = winston.format;

const APP_LOG_LEVEL = "info";
const log = console;
/**
 * Act as a cache so that we don't un-necessary change the
 * log level if there are no changes in the log level
 */
let currentLogLevel = APP_LOG_LEVEL;

/**
 * It updates the log level of all the transports of the logger
 * @param {string} logLevel - string - The log level to set.
 */
const updateLogLevel = (logger: winston.Logger, logLevel: string): void => {
  // eslint-disable-next-line functional/immutable-data
  logger.transports.forEach((transport) => (transport.level = logLevel));
};

/**
 * It checks if the log level has changed, and if it has, it updates the log level
 */
const unleashEventHandler = (
  logger: winston.Logger,
  unleash: Unleash,
  baseUrl: string,
  flagName: string,
  globalLogLevelKey: string,
  defaultVariantName: string,
  defaultLogLevel: string
): void => {
  log.info(`[unleashEventHandler] Got triggered`);
  const updatedLogLevel = getUpdatedLogLevel(
    unleash,
    baseUrl,
    flagName,
    globalLogLevelKey,
    defaultVariantName,
    defaultLogLevel
  );

  if (
    currentLogLevel.trim().toLowerCase() !==
    updatedLogLevel.trim().toLowerCase()
  ) {
    updateLogLevel(logger, updatedLogLevel);
    log.info(
      `[unleashEventHandler] updated the log level from: ${currentLogLevel} to: ${updatedLogLevel}`
    );

    currentLogLevel = updatedLogLevel;
  }
};

export const getInstance = (config: {
  unleash: Unleash;
  flagName: string;
  baseUrl: string;
  globalLogLevelKey: string;
  defaultVariantName: string;
}): winston.Logger => {
  const logLevel = "info";
  const logger = winston.createLogger({
    // default log level is "info"
    level: logLevel,

    // combining multiple formats to get the desired output
    format: combine(
      // required to log errors thrown by the application; ignored otherwise
      errors({ stack: true }),

      // enables string interpolation of messages
      splat(),

      // adds timestamp to all log messages
      timestamp(),

      // default log format is JSON
      json()
    ),

    transports: [
      // logs will be written to console
      new winston.transports.Console({
        // catch and log `uncaughtException` events from the application
        handleExceptions: true,

        // catch and log `uncaughtRejection` events from the application
        handleRejections: true,
      }),
    ],

    // generic metadata applied to all logs
    defaultMeta: { type: "application" },
  });

  /**
   * This hook is called when the unleash client is synchronized with the unleash server.
   */
  config.unleash?.once("synchronized", () => {
    unleashEventHandler(
      logger,
      config.unleash,
      config.baseUrl,
      config.flagName,
      config.globalLogLevelKey,
      config.defaultVariantName,
      logLevel
    );

    /**
     * This hook is called when the client gets new toggle state from unleash server and changes has been made.
     * This is intentionally being set in `synchronized` event so that there is no
     * race condition between the `synchronized` and `change` event when unleash initializes
     */

    /**
     * When this hook is called?
     * 1. Unleash client is initialized
     * 2. Feature flag is enabled/disabled
     * 3. Variant is added/removed
     * 4. Changes to the baseUrl of a feature flag
     */
    config.unleash?.on("changed", () => {
      unleashEventHandler(
        logger,
        config.unleash,
        config.baseUrl,
        config.flagName,
        config.globalLogLevelKey,
        config.defaultVariantName,
        logLevel
      );
    });
  });

  return logger;
};
