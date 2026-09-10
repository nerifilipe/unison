export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.message ?? `Request failed (${response.status}). Please try again.`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const headers = new Headers(init.headers);
    if (init.method && init.method !== "GET") {
      const token = await read<{ headerName: string; token: string }>(
        await fetch("/api/auth/csrf", {
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }),
      );
      headers.set(token.headerName, token.token);
    }
    return await read<T>(
      await fetch(path, {
        ...init,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        signal: init.signal ?? AbortSignal.timeout(15000),
      }),
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      (path.startsWith("/api/library") || path.startsWith("/api/uploads"))
    ) {
      window.dispatchEvent(new Event("unison-session-expired"));
    }
    if (error instanceof ApiError) throw error;
    throw new Error(
      "We could not reach Unison. Check your connection and try again.",
    );
  }
}

export function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
