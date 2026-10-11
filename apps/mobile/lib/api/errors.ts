export interface ApiErrorBody {
  message?: string;
  code?: string;
  feature?: string;
  removed?: Array<{
    id: number | string;
    name: string;
    futureMealsWithContent: number;
  }>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  feature?: string;
  data?: ApiErrorBody;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.status = status;
    this.code = body?.code;
    this.feature = body?.feature;
    this.data = body;
  }
}
