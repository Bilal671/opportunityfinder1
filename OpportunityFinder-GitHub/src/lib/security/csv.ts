/**
 * OWASP Formula Injection Protection:
 * Characters =, +, -, @, \t, \r at the beginning of a cell can trigger dynamic execution
 * in spreadsheet software like Excel, Google Sheets, or LibreOffice Calc.
 */
const INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitizes a single cell value to prevent CSV / Spreadsheet formula injection.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value).trim();

  // If the cell begins with any formula injection trigger, prefix with an apostrophe
  if (INJECTION_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    str = `'${str}`;
  }

  // Escape double quotes by doubling them
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds a safe CSV string from a 2D array of rows.
 */
export function buildSafeCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const sanitizedHeaders = headers.map(sanitizeCsvCell).join(',');
  const sanitizedRows = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [sanitizedHeaders, ...sanitizedRows].join('\r\n');
}

/**
 * Parses raw CSV text into rows and columns, cleaning quotes and whitespace.
 */
export function parseCsvText(rawText: string): string[][] {
  const lines = rawText.split(/\r\n|\n|\r/);
  const result: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const row: string[] = [];
    let insideQuotes = false;
    let currentCell = '';

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (char === '"') {
        if (insideQuotes && trimmed[i + 1] === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }

  return result;
}
