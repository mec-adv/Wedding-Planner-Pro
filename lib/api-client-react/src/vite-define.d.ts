/** Tipos mínimos para `VITE_*` quando o bundle inclui este pacote (Vite injeta em runtime). */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** Definido pelo Vite a partir de `base` (ex.: `/casamento360/`). */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
