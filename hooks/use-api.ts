"use client";

export async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "self-tasks-dashboard",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Request failed");
  }
  return payload.data as T;
}
