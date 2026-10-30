import { API_BASE } from './index';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Thin fetch wrapper: returns the parsed JSON body, throws ApiRequestError with the API's code/message. */
export async function apiRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', "Can't reach the loyalty server. Check your connection and try again.");
  }
  type Body = { success?: boolean; error?: { code?: string; message?: string } } & Record<string, unknown>;
  let json: Body;
  try {
    json = (await res.json()) as Body;
  } catch {
    throw new ApiRequestError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response. Try again.');
  }
  if (!res.ok || json.success === false) {
    throw new ApiRequestError(res.status, json.error?.code ?? 'UNKNOWN', json.error?.message ?? 'Something went wrong. Try again.');
  }
  return json as T;
}

/** GET an `{ success, data }` endpoint and unwrap `data`. */
export const apiData = async <T>(path: string) => (await apiRequest<{ data: T }>(path)).data;
