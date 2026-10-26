import { SpreadsheetRow, COL, INPUT_COL_COUNT } from './types';

export function parseTime(raw: string): string {
    const s = raw.trim();
    if (!s) return '';

    // Already HH:MM 24-hour
    const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
        return `${match24[1].padStart(2, '0')}:${match24[2]}`;
    }

    // 12-hour: "8:00 AM", "1:30PM", "8:00a", "12:30 p"
    const match12 = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm]?)$/);
    if (match12) {
        let h = parseInt(match12[1], 10);
        const m = match12[2];
        const ampm = match12[3].toUpperCase();

        if (ampm.startsWith('P') && h !== 12) h += 12;
        if (ampm.startsWith('A') && h === 12) h = 0;

        return `${String(h).padStart(2, '0')}:${m}`;
    }

    return s;
}

export function parseFlexDate(raw: string): Date | null {
    const s = raw.trim();
    if (!s) return null;

    // ISO: YYYY-MM-DD
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    }

    // American: M/D/YY or MM/DD/YY or MM/DD/YYYY
    const american = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (american) {
        const month = parseInt(american[1]) - 1;
        const day = parseInt(american[2]);
        let year = parseInt(american[3]);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
    }

    return null;
}

function isHeaderRow(cells: string[]): boolean {
    const crn = (cells[COL.CRN] || '').trim().toLowerCase();
    return crn === 'crn' || crn === '' || !/^\d+$/.test(crn);
}

/**
 * Split TSV text into records of cells using Excel's clipboard rules: a cell
 * that begins with `"` is quoted and may contain tabs/newlines, with `""`
 * representing a literal quote. Unquoted cells end at the next tab/newline.
 */
export function splitTsvRecords(text: string): string[][] {
    const records: string[][] = [];
    let record: string[] = [];
    let i = 0;
    const n = text.length;
    while (true) {
        let field = '';
        if (text[i] === '"') {
            const start = i;
            i++;
            let closed = false;
            while (i < n) {
                if (text[i] === '"') {
                    if (text[i + 1] === '"') { field += '"'; i += 2; }
                    else { i++; closed = true; break; }
                } else {
                    field += text[i++];
                }
            }
            if (!closed) {
                // Unbalanced quote: treat the cell as literal text up to the next delimiter
                i = start;
                field = '';
                while (i < n && text[i] !== '\t' && text[i] !== '\n') field += text[i++];
            } else {
                while (i < n && text[i] !== '\t' && text[i] !== '\n') field += text[i++];
            }
        } else {
            while (i < n && text[i] !== '\t' && text[i] !== '\n') field += text[i++];
        }
        record.push(field);
        if (i >= n) { records.push(record); break; }
        if (text[i] === '\t') { i++; continue; }
        i++; // newline
        records.push(record);
        record = [];
    }
    return records;
}

export function parseTsv(raw: string): { rows: SpreadsheetRow[]; warnings: string[] } {
    const warnings: string[] = [];
    const records = splitTsvRecords(raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
    const rows: SpreadsheetRow[] = [];

    let skippedHeader = false;

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (record.every(c => !c.trim())) continue;

        let cells = record.map(c => c.trim());

        // Detect header row (first non-empty line only)
        if (rows.length === 0 && !skippedHeader && isHeaderRow(cells)) {
            skippedHeader = true;
            continue;
        }

        if (cells.length < INPUT_COL_COUNT) {
            const padding = INPUT_COL_COUNT - cells.length;
            cells = [...cells, ...new Array(padding).fill('')];
            if (cells.length < INPUT_COL_COUNT - 5) {
                warnings.push(`Row ${i + 1}: only ${cells.length - padding} columns (expected ${INPUT_COL_COUNT}), padded with blanks`);
            }
        } else if (cells.length > INPUT_COL_COUNT) {
            cells = cells.slice(0, INPUT_COL_COUNT);
        }

        // Normalize time fields
        cells[COL.S_TIME] = parseTime(cells[COL.S_TIME]);
        cells[COL.E_TIME] = parseTime(cells[COL.E_TIME]);

        rows.push({ cells, rowIndex: i });
    }

    if (rows.length === 0) {
        warnings.push('No data rows found after parsing.');
    }

    return { rows, warnings };
}

export function groupByCRN(rows: SpreadsheetRow[]): Map<string, SpreadsheetRow[]> {
    const map = new Map<string, SpreadsheetRow[]>();
    for (const row of rows) {
        const crn = row.cells[COL.CRN];
        if (!crn) continue;
        const existing = map.get(crn);
        if (existing) existing.push(row);
        else map.set(crn, [row]);
    }
    return map;
}
