/**
 * Utility functions for parsing and formatting room features (Balcony vs Standard).
 */

export interface ParsedRoomInfo {
  rawRoomNumber: string;
  cleanRoomNumber: string;
  isBalcony: boolean;
  displayName: string;
}

/**
 * Parses a room number string to detect if it's a Balcony room.
 * Supports "101 (Balcony)", "101 [Balcony]", "101 - Balcony", "101 Balcony", etc.
 */
export function parseRoomDisplay(rawRoomNumber: string | null | undefined): ParsedRoomInfo {
  if (!rawRoomNumber) {
    return {
      rawRoomNumber: '',
      cleanRoomNumber: '?',
      isBalcony: false,
      displayName: '?',
    };
  }

  const raw = String(rawRoomNumber).trim();
  const isBalcony = /\bbalcony\b/i.test(raw);
  const cleanRoomNumber = raw.replace(/\s*[\(\[]?\s*balcony\s*[\)\]]?\s*/gi, '').trim() || raw;
  const displayName = isBalcony ? `${cleanRoomNumber} (Balcony)` : cleanRoomNumber;

  return {
    rawRoomNumber: raw,
    cleanRoomNumber,
    isBalcony,
    displayName,
  };
}

/**
 * Formats a base room number with or without the Balcony tag.
 */
export function formatRoomNumber(baseNumber: string, isBalcony: boolean): string {
  const clean = baseNumber.replace(/\s*[\(\[]?\s*balcony\s*[\)\]]?\s*/gi, '').trim();
  return isBalcony ? `${clean} (Balcony)` : clean;
}
