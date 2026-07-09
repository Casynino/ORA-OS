"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const TYPES = [
  "PHARMACY", "SUPERMARKET", "SHOP", "CLINIC", "SCHOOL", "NGO", "OTHER",
] as const;

const stockistSchema = z
  .object({
    name: z.string().min(2, "Store name is required.").max(160),
    type: z.enum(TYPES),
    region: z.string().min(2, "Region is required.").max(80),
    district: z.string().min(2, "District is required.").max(80),
    address: z.string().max(200).optional().or(z.literal("")),
    phone: z.string().max(40).optional().or(z.literal("")),
    hours: z.string().max(80).optional().or(z.literal("")),
    products: z.string().max(200).optional().or(z.literal("")),
    // Bounds match the map projection window exactly — anything accepted
    // here is guaranteed to render inside the map.
    lat: z
      .number()
      .min(-11.85, "Latitude must be within Tanzania (−11.85 to −0.85).")
      .max(-0.85, "Latitude must be within Tanzania (−11.85 to −0.85).")
      .optional()
      .nullable(),
    lng: z
      .number()
      .min(29.2, "Longitude must be within Tanzania (29.2 to 40.6).")
      .max(40.6, "Longitude must be within Tanzania (29.2 to 40.6).")
      .optional()
      .nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => (d.lat == null) === (d.lng == null), {
    message: "Enter both latitude and longitude, or leave both empty.",
  });

function revalidateCoverage() {
  revalidatePath("/find-ora");
  revalidatePath("/admin/stockists");
}

export async function createStockist(
  input: z.infer<typeof stockistSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = stockistSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid stockist.");
    const d = parsed.data;
    const s = await prisma.stockist.create({
      data: {
        name: d.name.trim(),
        type: d.type,
        region: d.region.trim(),
        district: d.district.trim(),
        address: d.address?.trim() || null,
        phone: d.phone?.trim() || null,
        hours: d.hours?.trim() || null,
        products: d.products?.trim() || null,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        isActive: d.isActive ?? true,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "STOCKIST_CREATED",
      entity: "Stockist",
      entityId: s.id,
      summary: `${actor.name} added stockist ${s.name} (${s.district}, ${s.region}).`,
    });
    revalidateCoverage();
    return ok(undefined, `${s.name} is now on the map.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function updateStockist(
  id: string,
  input: z.infer<typeof stockistSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = stockistSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid stockist.");
    const d = parsed.data;
    const existing = await prisma.stockist.findUnique({ where: { id } });
    if (!existing) return fail("Stockist not found.");
    await prisma.stockist.update({
      where: { id },
      data: {
        name: d.name.trim(),
        type: d.type,
        region: d.region.trim(),
        district: d.district.trim(),
        address: d.address?.trim() || null,
        phone: d.phone?.trim() || null,
        hours: d.hours?.trim() || null,
        products: d.products?.trim() || null,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        ...(d.isActive != null ? { isActive: d.isActive } : {}),
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "STOCKIST_UPDATED",
      entity: "Stockist",
      entityId: id,
      summary: `${actor.name} updated stockist ${d.name}.`,
    });
    revalidateCoverage();
    return ok(undefined, `${d.name} updated — the public map reflects it now.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleStockist(
  id: string,
  makeActive: boolean,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    // Explicit target state — concurrent clicks can't flip it the wrong way.
    const s = await prisma.stockist.update({
      where: { id },
      data: { isActive: makeActive },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: makeActive ? "STOCKIST_ENABLED" : "STOCKIST_DISABLED",
      entity: "Stockist",
      entityId: id,
      summary: `${actor.name} ${makeActive ? "published" : "hid"} stockist ${s.name} on the public map.`,
    });
    revalidateCoverage();
    return ok(undefined, `${s.name} is now ${makeActive ? "visible on" : "hidden from"} the map.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteStockist(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const s = await prisma.stockist.findUnique({ where: { id } });
    if (!s) return fail("Stockist not found.");
    await prisma.stockist.delete({ where: { id } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "STOCKIST_DELETED",
      entity: "Stockist",
      entityId: id,
      summary: `${actor.name} removed stockist ${s.name} (${s.district}, ${s.region}).`,
    });
    revalidateCoverage();
    return ok(undefined, `${s.name} removed.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
