import { apiFetch } from "./api";

type AuthResponse = { id: number; username: string; token: string };

export async function login(username: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("token", data.token);
  return data;
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("token", data.token);
  return data;
}

export function logout(): void {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

export async function verifyToken(): Promise<boolean> {
  try {
    await apiFetch("/auth/me");
    return true;
  } catch {
    return false;
  }
}
