export type PageFieldType = 'text' | 'textarea' | 'url' | 'boolean' | 'list' | 'items';
export interface PageFieldDefinition {
    key: string;
    label: string;
    type: PageFieldType;
    placeholder?: string;
    help?: string;
    itemFields?: Array<{
        key: string;
        label: string;
        type: 'text' | 'textarea';
    }>;
}
export interface PageSectionDefinition {
    key: string;
    label: string;
    description: string;
    fields: PageFieldDefinition[];
}
export interface PageDefinition {
    slug: string;
    title: string;
    description: string;
    sections: PageSectionDefinition[];
}
export declare const PAGE_DEFINITIONS: PageDefinition[];
export declare const DEFAULT_PAGE_CONTENT: Record<string, Record<string, unknown>>;
//# sourceMappingURL=pages.d.ts.map