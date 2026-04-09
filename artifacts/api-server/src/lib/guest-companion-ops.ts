import { db, guestCompanionsTable, eq, asc, inArray } from "@workspace/db";

export type CompanionJson = { id: number; name: string; age: number; phone: string | null };

export async function companionsByGuestIds(guestIds: number[]): Promise<Map<number, CompanionJson[]>> {
  const map = new Map<number, CompanionJson[]>();
  if (guestIds.length === 0) return map;
  const rows = await db
    .select()
    .from(guestCompanionsTable)
    .where(inArray(guestCompanionsTable.guestId, guestIds))
    .orderBy(asc(guestCompanionsTable.id));
  for (const r of rows) {
    const list = map.get(r.guestId) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      age: r.age,
      phone: r.phone ?? null,
    });
    map.set(r.guestId, list);
  }
  return map;
}

export async function replaceGuestCompanions(
  guestId: number,
  items: { name: string; age: number; phone?: string | null }[],
): Promise<void> {
  await db.delete(guestCompanionsTable).where(eq(guestCompanionsTable.guestId, guestId));
  if (items.length === 0) return;
  const rows = items
    .map((c) => ({
      guestId,
      name: c.name.trim(),
      age: c.age,
      phone: c.phone?.trim() ? c.phone.trim() : null,
    }))
    .filter((c) => c.name.length > 0);
  if (rows.length === 0) return;
  await db.insert(guestCompanionsTable).values(rows);
}
