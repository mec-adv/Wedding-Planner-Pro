import { randomBytes } from "node:crypto";

/** Token opaco de 64 caracteres hex para URL de convite público */
export function newInviteToken(): string {
  return randomBytes(32).toString("hex");
}
