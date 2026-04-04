import { Router, type IRouter } from "express";
import type { Wedding } from "@workspace/db";
import { pool } from "@workspace/db";
import {
  CreateWeddingBody,
  GetWeddingParams,
  UpdateWeddingParams,
  UpdateWeddingBody,
  DeleteWeddingParams,
} from "@workspace/api-zod";
import { authMiddleware, verifyWeddingAccess, type AuthRequest } from "../lib/auth";
import { weddingRowFromPg } from "../lib/wedding-pg";

const router: IRouter = Router();

function serializeWedding(w: Wedding) {
  return {
    ...w,
    date: w.date.toISOString(),
    createdAt: w.createdAt.toISOString(),
    civilCeremonyAt: w.civilCeremonyAt ? w.civilCeremonyAt.toISOString() : null,
    religiousCeremonyAt: w.religiousCeremonyAt ? w.religiousCeremonyAt.toISOString() : null,
  };
}

function earliestCeremonyDate(civil: Date, religious: Date): Date {
  return new Date(Math.min(civil.getTime(), religious.getTime()));
}

function countDefinedValues(obj: Record<string, unknown>): number {
  return Object.values(obj).filter((v) => v !== undefined).length;
}

type WeddingRowUpdate = Partial<
  Pick<
    Wedding,
    | "title"
    | "groomName"
    | "brideName"
    | "date"
    | "civilCeremonyAt"
    | "religiousCeremonyAt"
    | "venue"
    | "description"
    | "coverImageUrl"
  >
>;

router.get("/weddings", authMiddleware, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const authReq = req as AuthRequest;

  if (authReq.userRole === "admin") {
    const wRes = await pool.query(`SELECT * FROM weddings ORDER BY id`);
    const weddings = wRes.rows.map((r) => weddingRowFromPg(r as Record<string, unknown>));
    res.json(weddings.map((w) => serializeWedding(w)));
    return;
  }

  const pRes = await pool.query(`SELECT wedding_id FROM profiles WHERE user_id = $1`, [userId]);
  const profileWeddingIds = pRes.rows.map((r) => Number(r.wedding_id));

  let wRes;
  if (profileWeddingIds.length === 0) {
    wRes = await pool.query(`SELECT * FROM weddings WHERE created_by_id = $1 ORDER BY id`, [userId]);
  } else {
    wRes = await pool.query(
      `SELECT * FROM weddings WHERE created_by_id = $1 OR id = ANY($2::int[]) ORDER BY id`,
      [userId, profileWeddingIds],
    );
  }
  const weddings = wRes.rows.map((r) => weddingRowFromPg(r as Record<string, unknown>));
  res.json(weddings.map((w) => serializeWedding(w)));
});

router.post("/weddings", authMiddleware, async (req, res): Promise<void> => {
  const body = { ...(req.body ?? {}) } as Record<string, unknown>;
  if (typeof body.date === "string") body.date = new Date(body.date);
  if (typeof body.civilCeremonyAt === "string") body.civilCeremonyAt = new Date(body.civilCeremonyAt);
  if (typeof body.religiousCeremonyAt === "string") body.religiousCeremonyAt = new Date(body.religiousCeremonyAt);

  const parsed = CreateWeddingBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const groomName = parsed.data.groomName?.trim() ?? "";
  const brideName = parsed.data.brideName?.trim() ?? "";
  if (!groomName || !brideName) {
    res.status(400).json({ error: "Informe o nome do noivo(a) e da noiva(o)." });
    return;
  }

  const civil = parsed.data.civilCeremonyAt;
  const religious = parsed.data.religiousCeremonyAt;
  if (!civil || !religious) {
    res.status(400).json({ error: "Informe as datas da cerimônia civil e religiosa." });
    return;
  }
  if (Number.isNaN(civil.getTime()) || Number.isNaN(religious.getTime())) {
    res.status(400).json({ error: "Datas das cerimônias inválidas." });
    return;
  }

  const date = earliestCeremonyDate(civil, religious);
  const userId = (req as AuthRequest).userId;

  const ins = await pool.query(
    `INSERT INTO weddings (
      title, groom_name, bride_name, date, civil_ceremony_at, religious_ceremony_at,
      venue, description, cover_image_url, created_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      parsed.data.title?.trim() || `${groomName} & ${brideName}`,
      groomName,
      brideName,
      date,
      civil,
      religious,
      parsed.data.venue ?? null,
      parsed.data.description ?? null,
      parsed.data.coverImageUrl ?? null,
      userId,
    ],
  );
  const row = ins.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.status(500).json({ error: "Falha ao criar casamento." });
    return;
  }
  const wedding = weddingRowFromPg(row);

  await pool.query(`INSERT INTO profiles (user_id, wedding_id, role) VALUES ($1, $2, $3)`, [
    userId,
    wedding.id,
    "planner",
  ]);

  await pool.query(
    `INSERT INTO guest_groups (wedding_id, name) VALUES ($1, 'Colegas'), ($1, 'Trabalho'), ($1, 'Família')`,
    [wedding.id],
  );

  res.status(201).json(serializeWedding(wedding));
});

router.get("/weddings/:id", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  const params = GetWeddingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existingRes = await pool.query(`SELECT * FROM weddings WHERE id = $1`, [params.data.id]);
  const row = existingRes.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: "Casamento não encontrado" });
    return;
  }

  res.json(serializeWedding(weddingRowFromPg(row)));
});

router.patch("/weddings/:id", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  try {
    const params = UpdateWeddingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = { ...(req.body ?? {}) } as Record<string, unknown>;
    for (const key of ["date", "civilCeremonyAt", "religiousCeremonyAt"] as const) {
      const v = body[key];
      if (typeof v === "string") {
        const dt = new Date(v);
        if (!Number.isNaN(dt.getTime())) body[key] = dt;
      }
    }

    const parsed = UpdateWeddingBody.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const existingRes = await pool.query(`SELECT * FROM weddings WHERE id = $1`, [params.data.id]);
    const existingRow = existingRes.rows[0] as Record<string, unknown> | undefined;
    if (!existingRow) {
      res.status(404).json({ error: "Casamento não encontrado" });
      return;
    }
    let existing: Wedding;
    try {
      existing = weddingRowFromPg(existingRow);
    } catch (mapErr) {
      console.error("[PATCH /weddings/:id] weddingRowFromPg", mapErr);
      res.status(500).json({ error: "Resposta do banco para este casamento está incompleta ou inválida." });
      return;
    }

    const d = parsed.data;
    /** Mesmo conteúdo parseado que `body` (spread de req.body); nunca use req.body direto — pode ser undefined sem JSON. */
    const rawBody = body;
    const updateValues: WeddingRowUpdate = {};

    if (d.title !== undefined) updateValues.title = d.title;
    if (d.groomName !== undefined) updateValues.groomName = d.groomName;
    if (d.brideName !== undefined) updateValues.brideName = d.brideName;
    if (d.date !== undefined) updateValues.date = d.date;
    if (d.civilCeremonyAt !== undefined) updateValues.civilCeremonyAt = d.civilCeremonyAt;
    if (d.religiousCeremonyAt !== undefined) updateValues.religiousCeremonyAt = d.religiousCeremonyAt;
    if (d.venue !== undefined) updateValues.venue = d.venue;
    if (d.description !== undefined) updateValues.description = d.description;
    if (d.coverImageUrl !== undefined) updateValues.coverImageUrl = d.coverImageUrl;

    const nextCivil = (d.civilCeremonyAt ?? existing.civilCeremonyAt) ?? null;
    const nextReligious = (d.religiousCeremonyAt ?? existing.religiousCeremonyAt) ?? null;
    if (nextCivil && nextReligious) {
      updateValues.date = earliestCeremonyDate(nextCivil, nextReligious);
    }

    if (typeof rawBody.groomName === "string" && rawBody.groomName.trim()) {
      updateValues.groomName = rawBody.groomName.trim();
    }
    if (typeof rawBody.brideName === "string" && rawBody.brideName.trim()) {
      updateValues.brideName = rawBody.brideName.trim();
    }
    if (typeof rawBody.title === "string") {
      updateValues.title = rawBody.title.trim();
    }

    if (countDefinedValues(updateValues as Record<string, unknown>) === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar." });
      return;
    }

    const merged = {
      title: updateValues.title !== undefined ? updateValues.title : existing.title,
      groomName: updateValues.groomName !== undefined ? updateValues.groomName : existing.groomName,
      brideName: updateValues.brideName !== undefined ? updateValues.brideName : existing.brideName,
      date: updateValues.date !== undefined ? updateValues.date : existing.date,
      civilCeremonyAt:
        updateValues.civilCeremonyAt !== undefined ? updateValues.civilCeremonyAt : existing.civilCeremonyAt,
      religiousCeremonyAt:
        updateValues.religiousCeremonyAt !== undefined
          ? updateValues.religiousCeremonyAt
          : existing.religiousCeremonyAt,
      venue: updateValues.venue !== undefined ? updateValues.venue : existing.venue,
      description: updateValues.description !== undefined ? updateValues.description : existing.description,
      coverImageUrl:
        updateValues.coverImageUrl !== undefined ? updateValues.coverImageUrl : existing.coverImageUrl,
    };

    await pool.query(
      `UPDATE weddings SET
        title = $1,
        groom_name = $2,
        bride_name = $3,
        date = $4,
        civil_ceremony_at = $5,
        religious_ceremony_at = $6,
        venue = $7,
        description = $8,
        cover_image_url = $9,
        updated_at = NOW()
      WHERE id = $10`,
      [
        merged.title,
        merged.groomName,
        merged.brideName,
        merged.date,
        merged.civilCeremonyAt ?? null,
        merged.religiousCeremonyAt ?? null,
        merged.venue ?? null,
        merged.description ?? null,
        merged.coverImageUrl ?? null,
        params.data.id,
      ],
    );

    const afterRes = await pool.query(`SELECT * FROM weddings WHERE id = $1`, [params.data.id]);
    const outRow = afterRes.rows[0] as Record<string, unknown> | undefined;
    if (!outRow) {
      res.status(404).json({ error: "Casamento não encontrado" });
      return;
    }

    res.json(serializeWedding(weddingRowFromPg(outRow)));
  } catch (err) {
    console.error("[PATCH /weddings/:id]", err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    const message = err instanceof Error ? err.message : "Erro ao atualizar casamento";
    res.status(500).json({ error: message });
  }
});

router.delete("/weddings/:id", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  const params = DeleteWeddingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const id = params.data.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM profiles WHERE wedding_id = $1`, [id]);
    await client.query(`DELETE FROM invitations WHERE wedding_id = $1`, [id]);
    await client.query(`DELETE FROM weddings WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.sendStatus(204);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[DELETE /weddings/:id]", err);
    const message = err instanceof Error ? err.message : "Erro ao apagar casamento";
    res.status(500).json({ error: message });
  } finally {
    client.release();
  }
});

export default router;
