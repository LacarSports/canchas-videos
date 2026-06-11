// ID anónimo persistente por navegador, para contar visitas a videos sin login.

const SESSION_KEY = "lacar_session_id";

/**
 * Devuelve el session_id anónimo del navegador, generándolo y guardándolo en
 * localStorage la primera vez. En el servidor (SSR) devuelve "".
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
