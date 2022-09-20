import { Unleash } from "unleash-client";
import winston from "winston";

const logger = console;

/**
 * Note: `winston.config.npm.levels` is the default level values of winston
 */
//TODO : Replace `winston.config.npm.levels` to `logger.levels` once we move to @safe-security/logger package
const validLogLevel = new Set(Object.keys(winston.config.npm.levels));

/**
 * It returns an array of variant names that are applicable to the tenant
 * @returns An array of strings.
 */
const getApplicableVariantNames = (
  baseUrl: string,
  defaultVariantName: string
): string[] => {
  const hostname = new URL(baseUrl).hostname.trim().toLowerCase();
  return [hostname, defaultVariantName];
};

/**
 * It takes an object, and returns a new object with all the keys and values lowercased and trimmed
 * @param source - The object to be sanitized.
 */
const sanitize = (source: Record<string, string>): Record<string, string> =>
  Object.keys(source).reduce((destination, key) => {
    return {
      ...destination,
      [key.toLowerCase().trim()]: source[key].trim().toLowerCase(),
    };
  }, {});

/**
 * It fetches the log level from Unleash and returns the log level if it's a valid log level, else it
 * returns the default log level
 */
export const getUpdatedLogLevel = (
  unleash: Unleash,
  baseUrl: string,
  flagName: string,
  globalLogLevelKey: string,
  defaultVariantName: string,
  defaultLogLevel: string
): string => {
  let logLevel = defaultLogLevel;
  try {
    /**
     * Check if the flag is enabled for the said tenant
     * else fallback to SAFE default log level
     */
    if (unleash?.isEnabled(flagName)) {
      const variant = unleash.getVariant(flagName);

      const applicableVariantNames = getApplicableVariantNames(
        baseUrl,
        defaultVariantName
      );

      /**
       * Fields:
       * 1. name (Example: `hostname of the tenant` or `default`): `name` should exist and should match to .env value (trimmed and lowercased), in case there are no variants the `name` is undefined
       * 2. payload ({"global" : "<log-level>"}}: `payload` should exist, must be a valid JSON and should have value as one of SAFE supported level, in case there are no variants the `payload` is undefined
       * 3. enabled (true or false): in case there are no variants the `enabled` is false.
       */
      const { name, payload, enabled: isEnabled } = variant;

      if (
        name &&
        payload &&
        isEnabled &&
        payload.value &&
        JSON.parse(payload.value) &&
        applicableVariantNames.includes(name.trim().toLowerCase())
      ) {
        const tempPayload = JSON.parse(payload.value) as Record<string, string>;
        const logConfig = sanitize(tempPayload);

        if (
          globalLogLevelKey in logConfig &&
          logConfig[globalLogLevelKey] &&
          validLogLevel.has(logConfig[globalLogLevelKey])
        ) {
          logLevel = logConfig[globalLogLevelKey];
        }
      }
    }
  } catch (error) {
    logger.error(
      `[getUpdatedLogLevel] error occurred while fetching the log level. error: ${error}`
    );
  }
  return logLevel;
};
