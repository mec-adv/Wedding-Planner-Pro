/** Tipos mínimos para `VITE_*` quando o bundle inclui este pacote (Vite injeta em runtime). */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
