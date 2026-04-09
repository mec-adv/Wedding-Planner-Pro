/**
 * Envia imagem para o armazenamento do casamento (mesmo endpoint dos presentes).
 * Retorna a URL pública para usar em config da página ou em `imageUrl` de presentes.
 */
export async function uploadWeddingGiftImage(weddingId: number, file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/weddings/${weddingId}/gifts/upload-image`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Falha no envio da imagem");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
