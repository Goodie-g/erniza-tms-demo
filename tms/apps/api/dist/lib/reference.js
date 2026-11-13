/**
 * Generates an annual, human-readable reference such as ENQ-2026-0042.
 * Must be called inside a transaction so the counter increment and the
 * document insert commit atomically.
 */
export async function nextReference(tx, prefix, year = new Date().getFullYear()) {
    const result = await tx.query(`INSERT INTO document_counters (prefix, year, last_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (prefix, year)
     DO UPDATE SET last_value = document_counters.last_value + 1
     RETURNING last_value`, [prefix, year]);
    const value = result.rows[0]?.last_value ?? 1;
    return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
}
export function slugify(value) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
}
