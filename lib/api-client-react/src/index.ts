export * from "./generated/api";
export * from "./generated/api.schemas";
/** Tipos usados pelo app; garantem export estável com project references (`dist`). */
export type {
  PersonContact,
  VenueDetail,
  Wedding,
  WeddingInput,
} from "./generated/api.schemas";
export { ApiError, ResponseParseError } from "./custom-fetch";
export { resolveViteApiBase } from "./resolve-vite-api-base";
