import type { WeddingInput } from "./api.schemas";

/**
 * Orval pode gerar mutationFn como `const { data } = props` — se o caller passar
 * o payload plano (sem wrapper `data`), `data` fica undefined e JSON.stringify(undefined)
 * não envia corpo; o Express deixa req.body undefined e o PATCH quebra em rawBody.groomName.
 */
export function pickCreateWeddingMutationInput(
  props: { data?: WeddingInput } | WeddingInput | null | undefined,
): WeddingInput {
  if (props == null || typeof props !== "object") return {} as WeddingInput;
  if (
    props.data !== undefined &&
    props.data !== null &&
    typeof props.data === "object" &&
    !Array.isArray(props.data)
  ) {
    return props.data as WeddingInput;
  }
  const { data: _d, ...rest } = props as { data?: unknown } & Record<string, unknown>;
  return rest as WeddingInput;
}

export function pickUpdateWeddingMutationInput(
  props:
    | { id: number; data?: WeddingInput }
    | (WeddingInput & { id: number })
    | null
    | undefined,
): { id: number; data: WeddingInput } {
  if (props == null || typeof props !== "object") {
    return { id: NaN, data: {} as WeddingInput };
  }
  const id = Number((props as { id: number }).id);
  if (
    props.data !== undefined &&
    props.data !== null &&
    typeof props.data === "object" &&
    !Array.isArray(props.data)
  ) {
    return { id, data: props.data as WeddingInput };
  }
  const { id: _id, data: _d, ...rest } = props as { id: number; data?: unknown } & Record<string, unknown>;
  return { id, data: rest as WeddingInput };
}
