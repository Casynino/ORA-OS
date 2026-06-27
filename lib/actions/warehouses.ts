"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

function revalidateWarehouses() {
  revalidatePath("/admin/warehouses");
  revalidatePath("/admin/transfers");
}

const createSchema = z.object({
  name: z.string().min(2, "Name is required."),
  location: z.string().max(120).optional(),
  capacity: z.number().int().positive().max(100000000).optional(),
});

export async function createWarehouse(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid warehouse.");
    }
    const w = await prisma.warehouse.create({
      data: {
        name: parsed.data.name.trim(),
        location: parsed.data.location?.trim() || null,
        capacity: parsed.data.capacity ?? null,
        status: "ACTIVE",
        isActive: true,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "WAREHOUSE_CREATED",
      entity: "Warehouse",
      entityId: w.id,
      summary: `${admin.name} created warehouse ${w.name}.`,
    });
    revalidateWarehouses();
    return ok(undefined, `${w.name} created.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  location: z.string().max(120).optional(),
  capacity: z.number().int().positive().max(100000000).nullable().optional(),
  status: z.enum(["ACTIVE", "OFFLINE", "MAINTENANCE"]).optional(),
});

export async function updateWarehouse(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid update.");
    }
    const { id, status } = parsed.data;
    const w = await prisma.warehouse.update({
      where: { id },
      data: {
        name: parsed.data.name?.trim(),
        location: parsed.data.location?.trim(),
        capacity: parsed.data.capacity ?? undefined,
        status,
        // Keep the legacy isActive flag in step with status.
        isActive: status ? status === "ACTIVE" : undefined,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "WAREHOUSE_UPDATED",
      entity: "Warehouse",
      entityId: w.id,
      summary: `${admin.name} updated warehouse ${w.name}${status ? ` (${status.toLowerCase()})` : ""}.`,
    });
    revalidateWarehouses();
    revalidatePath(`/admin/warehouses/${id}`);
    return ok(undefined, "Warehouse updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
