import { getLogger } from "./logger.ts";

const logger = getLogger();

export function Deprecated(replaceWith: string) {
  return function (_target: any, propertyKey: string, _descriptor: PropertyDescriptor) {
    logger.warn(`${propertyKey} is deprecated and will be removed in future versions. Use ${replaceWith} instead.`);
  };
}

export function Experimental() {
  return function (_target: any, propertyKey: string, _descriptor: PropertyDescriptor) {
    logger.warn(`${propertyKey} is marked as experimental. It is subject to change and should be used with caution.`);
  };
}
