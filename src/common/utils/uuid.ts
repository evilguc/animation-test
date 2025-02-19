/**
 * Extracts timestamp from UUIDv7
 * @param {string} uuid string representation of UUIDv7
 * @returns {number} timestamp
 */
export function extractTimestampFromUUIDv7(uuid: string): number {
  const parts = uuid.split("-");
  const timestampPart = parts.slice(0, 2).join("");
  return parseInt(timestampPart, 16);
}
