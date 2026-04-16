/**
 * Copia texto para a área de transferência.
 * Em HTTP com IP (ex.: homolog sem HTTPS), `navigator.clipboard` costuma falhar;
 * usa fallback com `document.execCommand("copy")` após gesto do usuário.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof window === "undefined") return;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fallback abaixo */
    }
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);

  try {
    const ok = document.execCommand("copy");
    if (!ok) {
      throw new Error("execCommand('copy') retornou false");
    }
  } finally {
    document.body.removeChild(ta);
  }
}
