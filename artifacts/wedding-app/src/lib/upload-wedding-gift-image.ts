import { apiFetchPath } from "@/lib/api-url";

/** Subpastas em `uploads/users/.../evento/`: presentes, padrinhos, artes do hero/nav. */
export type WeddingMediaCategory = "gift" | "padrinhos" | "branding";

/**
 * Envia imagem para a pasta do casamento conforme a categoria.
 * - `gift` — catálogo de presentes
 * - `padrinhos` — fotos dos padrinhos no convite
 * - `branding` — poster do hero e monograma/logo no menu
 */
export async function uploadWeddingMedia(
  weddingId: number,
  file: File,
  category: WeddingMediaCategory,
): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("category", category);
  const res = await fetch(apiFetchPath(`/weddings/${weddingId}/gifts/upload-image`), {
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

/** Presentes: pasta `gift`. */
export async function uploadWeddingGiftImage(weddingId: number, file: File): Promise<string> {
  return uploadWeddingMedia(weddingId, file, "gift");
}
