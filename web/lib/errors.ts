// Error shape from SPEC.md 4.1: { error: { code, message, field? } }

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export const bad = (code: string, message: string, field?: string) => new ApiError(400, code, message, field);
export const forbidden = (message = 'Your role does not allow this.') => new ApiError(403, 'not_allowed', message);
export const notFound = (what = 'Not found.') => new ApiError(404, 'not_found', what);
