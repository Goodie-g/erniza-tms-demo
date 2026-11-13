export function parsePagination(req, defaultPageSize = 20) {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const rawSize = Number.parseInt(String(req.query.pageSize ?? defaultPageSize), 10) || defaultPageSize;
    const pageSize = Math.min(100, Math.max(1, rawSize));
    const q = String(req.query.q ?? '').trim().slice(0, 200);
    return { page, pageSize, offset: (page - 1) * pageSize, q };
}
export function paginationMeta(page, pageSize, total) {
    return {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
}
export function queryString(req, key) {
    const value = req.query[key];
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
export function queryDate(req, key) {
    const value = queryString(req, key);
    if (!value)
        return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return undefined;
    return value;
}
export function escapeLike(value) {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
export function csvCell(value) {
    if (value === null || value === undefined)
        return '';
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function toCsv(rows, headers) {
    const lines = [headers.map((header) => csvCell(header.label)).join(',')];
    for (const row of rows) {
        lines.push(headers.map((header) => csvCell(row[header.key])).join(','));
    }
    return lines.join('\r\n');
}
