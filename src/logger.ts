/**
 * Logger interface for custom logging implementations.
 *
 * This interface defines the methods required for logging informational messages,
 * warnings, and errors. Users can implement this interface to provide their own
 * logging mechanisms, allowing integration with various logging libraries or
 * custom loggers.
 *
 * By providing a custom logger that implements this interface, users can control
 * how log messages are handled and where they are output.
 *
 * @interface Logger
 *
 * @example
 * // Example implementation of a custom logger
 * class CustomLogger implements Logger {
 *   info(message: string): void {
 *     console.log(`INFO: ${message}`);
 *   }
 *
 *   warn(message: string): void {
 *     console.warn(`WARN: ${message}`);
 *   }
 *
 *   error(message: string): void {
 *     console.error(`ERROR: ${message}`, error);
 *   }
 * }
 *
 * // Using the custom logger with EventBus
 * const logger = new CustomLogger();
 * const eventBus = new EventBus<MyEventSchema>(50, 3, undefined, logger);
 *
 * @example
 * // Using a third-party logging library like Winston
 * import { createLogger, format, transports } from 'winston';
 *
 * class WinstonLogger implements Logger {
 *   private logger = createLogger({
 *     level: 'info',
 *     format: format.combine(
 *       format.timestamp(),
 *       format.printf(({ timestamp, level, message }) => {
 *         return `${timestamp} [${level}]: ${message}`;
 *       })
 *     ),
 *     transports: [new transports.Console()],
 *   });
 *
 *   info(message: string): void {
 *     this.logger.info(message);
 *   }
 *
 *   warn(message: string): void {
 *     this.logger.warn(message);
 *   }
 *
 *   error(message: string, error?: any): void {
 *     this.logger.error(message, error);
 *   }
 * }
 */
export interface Logger {
  /**
   * Logs an informational message.
   *
   * This method is used to log general informational messages that are useful
   * for tracking the flow and state of the application.
   *
   * @param {string} message - The message to log.
   *
   * @example
   * logger.info('Event processed successfully.');
   */
  info(message: string): void;

  /**
   * Logs a warning message.
   *
   * This method is used to log warning messages that indicate a potential issue
   * that might need attention but is not critical.
   *
   * @param {string} message - The warning message to log.
   *
   * @example
   * logger.warn('Event processing is taking longer than expected.');
   */
  warn(message: string): void;

  /**
   * Logs an error message.
   *
   * This method is used to log error messages that indicate something went wrong
   * in the application. It can optionally take an error object to provide more
   * detailed information about the error.
   *
   * @param {string} message - The error message to log.
   * @param {any} [error] - Optional error object providing additional details about the error.
   *
   * @example
   * logger.error('Failed to process event.', new Error('Processing error'));
   */
  error(message: string, error?: any): void;
}

let instance: Logger | null = null;

/**
 * Internal function to retrieve the current logger instance.
 *
 * This function is used internally by the library to get the current logger instance.
 * If no custom logger has been set, it defaults to returning the console, ensuring
 * that logging is always available.
 *
 * @returns {Logger} The current logger instance, or the console if no custom logger is set.
 *
 * @internal Not intended for external use.
 */
export const getLogger = (): Logger => {
  if (!instance) {
    return console as unknown as Logger;
  }
  return instance;
};

/**
 * Configuration class for managing the global logger instance within the library.
 *
 * This provides a static method for setting a custom logger that implements the `Logger`
 * interface. The custom logger can be used to route log messages to different logging
 * mechanisms as required by the user. If no custom logger is set, the library defaults
 * to using the console for logging.
 *
 * Example Usage:
 *
 * ```typescript
 * // Define a custom logger
 * class CustomLogger implements Logger {
 *   info(message: string): void {
 *     console.log(`INFO: ${message}`);
 *   }
 *
 *   warn(message: string): void {
 *     console.warn(`WARN: ${message}`);
 *   }
 *
 *   error(message: string): void {
 *     console.error(`ERROR: ${message}`, error);
 *   }
 * }
 *
 * // Set the custom logger
 * LoggerConfig.setLogger(new CustomLogger());
 * ```
 */
export class LoggerConfig {
  /**
   * Assigns a custom logger instance to be used globally within the library.
   *
   * This function allows users to provide their own logger that implements the `Logger`
   * interface. Once set, all logging operations within the library will be routed
   * through the provided logger. This is necessary if logs from the library need to
   * end up somewhere other than the console.
   *
   * @param {Logger} logger - An object that implements the `Logger` interface, providing
   *                          custom implementations for the logging methods.
   *
   * @example
   * // Example of setting a custom logger
   * const customLogger = new CustomLogger();
   * MonadysseyLogger.setLogger(customLogger);
   */
  static setLogger = (logger: Logger): void => {
    instance = logger;
  };
}
