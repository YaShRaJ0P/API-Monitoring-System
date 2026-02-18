import { v4 as uuidv4 } from "uuid";

/**
 * Generates a unique event ID using UUID v4.
 * Used to uniquely identify each API telemetry event.
 *
 * @returns A UUID v4 string
 */
export function generateEventId(): string {
    return uuidv4();
}
