import winston, { config } from "winston";
import { Unleash } from "unleash-client";
import { getUpdatedLogLevel } from "./getUpdatedLogLevel";
const { combine, errors, timestamp, splat, json } = winston.format;

export interface SafeLoggerConfig {
  unleash: Unleash;
  flagName: string;
  baseUrl: string;
  globalLogLevelKey: string;
  defaultVariantName: string;
}

export class SafeLogger {
  private unleash: Unleash;

  private currentLogLevel: string;

  private defaultLogLevel: string;

  logger: winston.Logger;

  constructor({
    unleash,
    flagName,
    baseUrl,
    globalLogLevelKey,
    defaultVariantName,
  }: SafeLoggerConfig) {
    this.logger = this.createLogger();
    // default log level is "info"
    this.defaultLogLevel = "info";
    this.currentLogLevel = this.defaultLogLevel;
    this.unleash = unleash;

    /**
     * This hook is called when the unleash client is synchronized with the unleash server.
     */
    this.unleash.once("synchronized", () => {
      this.unleashEventHandler(
        baseUrl,
        flagName,
        globalLogLevelKey,
        defaultVariantName
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
      this.unleash.on("changed", () => {
        this.unleashEventHandler(
          baseUrl,
          flagName,
          globalLogLevelKey,
          defaultVariantName
        );
      });
    });
  }

  use(unleash: Unleash) {}

  private createLogger(): winston.Logger {
    return winston.createLogger({
      level: this.defaultLogLevel,

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
  }

  /**
   * It checks if the log level has changed, and if it has, it updates the log level
   */
  private unleashEventHandler = (
    baseUrl: string,
    flagName: string,
    globalLogLevelKey: string,
    defaultVariantName: string
  ): void => {
    const updatedLogLevel = getUpdatedLogLevel(
      this.unleash,
      baseUrl,
      flagName,
      globalLogLevelKey,
      defaultVariantName,
      this.defaultLogLevel
    );

    if (
      this.currentLogLevel.trim().toLowerCase() !==
      updatedLogLevel.trim().toLowerCase()
    ) {
      this.updateLogLevel(updatedLogLevel);
      console.info(
        `[unleashEventHandler] updated the log level from: ${this.currentLogLevel} to: ${updatedLogLevel}`
      );

      this.currentLogLevel = updatedLogLevel;
    }
  };

  /**
   * It updates the log level of all the transports of the logger
   * @param {string} logLevel - string - The log level to set.
   */
  private updateLogLevel = (logLevel: string): void => {
    this.logger.transports.forEach((transport) => (transport.level = logLevel));
  };
}
