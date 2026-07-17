"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { dashboardPath } from "@/lib/rbac";
import { fail, ok, type ActionResult } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fail("Please enter a valid email and password.");
  }
  const email = parsed.data.email.toLowerCase().trim();

  // Friendly messaging for non-active accounts (authorize() returns null for these).
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.status === "PENDING") {
    return fail("Your partner account is awaiting admin approval.");
  }
  if (existing?.status === "SUSPENDED") {
    return fail("This account has been suspended. Contact the administrator.");
  }

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail("Invalid email or password.");
    }
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "USER_LOGIN",
      entity: "User",
      entityId: user.id,
      summary: `${user.name} signed in.`,
    });
  }
  redirect(dashboardPath(user?.role));
}

const registerSchema = z.object({
  // Partners are identified by their business/organisation name only — no
  // personal full name. Phone is required so we can always reach them.
  organization: z.string().trim().min(2, "Enter your business or organisation name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  region: z.string().optional(),
  district: z.string().optional(),
  street: z.string().optional(),
  businessType: z.string().optional(),
  expectedVolume: z.string().optional(),
  preferredPayment: z.string().optional(),
  businessLicense: z.string().optional(),
  taxId: z.string().optional(),
});

/**
 * Partner application. Only partners (agents/distributors/NGOs/schools) register
 * — the general public never creates an account. New partners start PENDING and
 * must be approved by an admin before they can sign in.
 */
export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Please check your details.",
      parsed.error.flatten().fieldErrors,
    );
  }
  const data = parsed.data;
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return fail("An account with this email already exists.");
  }

  const region = data.region?.trim() || null;
  const district = data.district?.trim() || null;
  const street = data.street?.trim() || null;
  // The address provided at registration becomes the default delivery address.
  const location = [street, district, region].filter(Boolean).join(", ") || null;

  const org = data.organization.trim();
  const user = await prisma.user.create({
    data: {
      name: org, // partners are known by their business/organisation name only
      email,
      passwordHash: await bcrypt.hash(data.password, 10),
      phone: data.phone.trim(),
      role: "PARTNER",
      status: "PENDING",
      organization: org,
      region,
      district,
      street,
      location,
      businessType: data.businessType?.trim() || null,
      expectedVolume: data.expectedVolume?.trim() || null,
      preferredPayment: data.preferredPayment?.trim() || null,
      businessLicense: data.businessLicense?.trim() || null,
      taxId: data.taxId?.trim() || null,
    },
  });

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "PARTNER_REQUESTED_ACCESS",
    entity: "User",
    entityId: user.id,
    summary: `${user.name} applied for partner access${
      user.organization ? ` (${user.organization})` : ""
    }.`,
  });

  return ok(
    undefined,
    "Partner application submitted. An admin will review and activate your account shortly.",
  );
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
