export interface PaginationOptions {
    page?: any;
    limit?: any;
    defaultLimit?: number;
}

export interface PaginationResult {
    page: number;
    limit: number;
    offset: number;
}

export const getPagination = (options: PaginationOptions): PaginationResult => {
    const page = Math.max(1, parseInt(options.page as string) || 1);
    const limit = Math.max(1, parseInt(options.limit as string) || (options.defaultLimit || 50));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
};
