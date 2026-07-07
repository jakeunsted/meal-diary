export interface ApiErrorBody {
  message?: string;
  code?: string;
  feature?: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  feature?: string;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.status = status;
    this.code = body?.code;
    this.feature = body?.feature;
  }
}
