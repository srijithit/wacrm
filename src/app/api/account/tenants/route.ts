import crypto from "crypto";
import { NextResponse } from "next/server";
import { getCurrentAccount, requireRole, toErrorResponse } from "@/lib/auth/account";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/whatsapp/encryption";

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase.rpc("list_tenants");
    if (error) {
      console.error("[GET /api/account/tenants] rpc error:", error);
      return NextResponse.json({ error: "Failed to list tenants" }, { status: 500 });
    }

    const rawTenants: Array<{
      id: string;
      name: string;
      owner_user_id: string;
      created_at: string;
      is_current: boolean;
      is_owner: boolean;
      member_count: number;
    }> = data ?? [];

    if (rawTenants.length === 0) {
      return NextResponse.json({ tenants: [] });
    }

    // Enrich tenants with assigned customer member credentials & WhatsApp connection status
    const admin = getAdminClient();
    const tenantIds = rawTenants.map((t) => t.id);

    const [profilesRes, configsRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, user_id, email, full_name, account_id, account_role")
        .in("account_id", tenantIds),
      admin
        .from("whatsapp_config")
        .select("account_id, phone_number_id, waba_id, status, connected_at")
        .in("account_id", tenantIds),
    ]);

    const profiles = profilesRes.data ?? [];
    const configs = configsRes.data ?? [];

    const enrichedTenants = rawTenants.map((t) => {
      const cfg = configs.find((c) => c.account_id === t.id);
      const members = profiles.filter((p) => p.account_id === t.id);
      // Prefer member who is not the admin caller, or first member
      const customer = members.find((p) => p.user_id !== ctx.userId) ?? members[0];

      return {
        ...t,
        customer_email: customer?.email ?? null,
        customer_name: customer?.full_name ?? null,
        customer_user_id: customer?.user_id ?? null,
        customer_role: customer?.account_role ?? null,
        whatsapp: {
          configured: Boolean(cfg?.phone_number_id),
          phone_number_id: cfg?.phone_number_id ?? null,
          waba_id: cfg?.waba_id ?? null,
          status: cfg?.status ?? "unconfigured",
          connected_at: cfg?.connected_at ?? null,
        },
      };
    });

    return NextResponse.json({ tenants: enrichedTenants });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const limit = checkRateLimit(`admin:create-tenant:${ctx.userId}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Tenant organization name is required" }, { status: 400 });
    }

    const customerEmail =
      typeof body?.customer_email === "string" ? body.customer_email.trim().toLowerCase() : "";
    const customerPassword =
      typeof body?.customer_password === "string" ? body.customer_password : "";
    const customerName =
      typeof body?.customer_name === "string" ? body.customer_name.trim() : "";
    const switchImmediately = Boolean(body?.switch_immediately);
    const whatsapp = body?.whatsapp && typeof body.whatsapp === "object" ? body.whatsapp : null;

    if (customerEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return NextResponse.json({ error: "Please enter a valid customer email address" }, { status: 400 });
      }
      if (!customerPassword || customerPassword.length < 6) {
        return NextResponse.json({ error: "Customer password must be at least 6 characters" }, { status: 400 });
      }
    }

    const admin = getAdminClient();

    // 1. Create the tenant organization account.
    // The admin ctx.userId is the owner_user_id so the admin can manage/switch to it anytime.
    const { data: tenantAccount, error: accError } = await admin
      .from("accounts")
      .insert({ name, owner_user_id: ctx.userId })
      .select("id, name, created_at")
      .single();

    if (accError || !tenantAccount) {
      console.error("[POST /api/account/tenants] create account error:", accError);
      return NextResponse.json({ error: accError?.message || "Failed to create tenant organization" }, { status: 400 });
    }

    let createdCustomer: { id: string; email: string } | null = null;

    // 2. If customer credentials are provided, provision their login user
    if (customerEmail && customerPassword) {
      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email: customerEmail,
        password: customerPassword,
        email_confirm: true, // auto-confirmed for immediate sign-in at /login
        user_metadata: {
          full_name: customerName || name,
        },
      });

      if (userError || !userData?.user) {
        // Rollback created account
        await admin.from("accounts").delete().eq("id", tenantAccount.id);
        console.error("[POST /api/account/tenants] createUser error:", userError);
        return NextResponse.json({ error: userError?.message || "Failed to create customer user account" }, { status: 400 });
      }

      createdCustomer = { id: userData.user.id, email: userData.user.email! };

      // Allow trigger to fire then re-assign customer's profile to tenantAccount
      const { data: profile } = await admin
        .from("profiles")
        .select("id, account_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      const oldAccountId = profile?.account_id;

      await admin
        .from("profiles")
        .update({
          account_id: tenantAccount.id,
          account_role: "admin",
        })
        .eq("user_id", userData.user.id);

      // Clean up auto-generated personal account
      if (oldAccountId && oldAccountId !== tenantAccount.id) {
        await admin
          .from("accounts")
          .delete()
          .eq("id", oldAccountId)
          .eq("owner_user_id", userData.user.id);
      }
    }

    // 3. If WhatsApp credentials were provided, configure them
    if (whatsapp?.phone_number_id && whatsapp?.access_token) {
      try {
        const encryptedAccessToken = encrypt(whatsapp.access_token.trim());
        const verifyToken = crypto.randomBytes(24).toString("hex");
        const encryptedVerifyToken = encrypt(verifyToken);
        await admin.from("whatsapp_config").insert({
          account_id: tenantAccount.id,
          user_id: ctx.userId,
          phone_number_id: whatsapp.phone_number_id.trim(),
          waba_id: whatsapp.waba_id?.trim() || null,
          access_token: encryptedAccessToken,
          verify_token: encryptedVerifyToken,
          status: "connected",
          connected_at: new Date().toISOString(),
        });
      } catch (waErr) {
        console.warn("[POST /api/account/tenants] whatsapp config save error:", waErr);
      }
    }

    // 4. Optionally switch admin's active workspace
    if (switchImmediately) {
      await ctx.supabase.rpc("switch_account", { target_account_id: tenantAccount.id });
    }

    return NextResponse.json({
      ok: true,
      tenant: tenantAccount,
      customer: createdCustomer,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const limit = checkRateLimit(`admin:patch-tenant:${ctx.userId}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const accountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";
    const action = typeof body?.action === "string" ? body.action.trim() : "";

    if (!accountId) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Verify account exists
    const { data: account, error: accErr } = await admin
      .from("accounts")
      .select("id, name, owner_user_id")
      .eq("id", accountId)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Tenant account not found" }, { status: 404 });
    }

    // Action 1: Reset or set customer password
    if (action === "set_customer_password") {
      const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
      const newPassword = typeof body?.new_password === "string" ? body.new_password : "";

      if (!userId) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 });
      }
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (pwdErr) {
        console.error("[PATCH /api/account/tenants] set password error:", pwdErr);
        return NextResponse.json({ error: pwdErr.message || "Failed to update password" }, { status: 400 });
      }

      return NextResponse.json({ ok: true, message: "Password updated successfully" });
    }

    // Action 2: Add customer login to an existing tenant
    if (action === "create_customer_user") {
      const customerEmail =
        typeof body?.customer_email === "string" ? body.customer_email.trim().toLowerCase() : "";
      const customerPassword =
        typeof body?.customer_password === "string" ? body.customer_password : "";
      const customerName =
        typeof body?.customer_name === "string" ? body.customer_name.trim() : "";

      if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return NextResponse.json({ error: "Please enter a valid customer email address" }, { status: 400 });
      }
      if (!customerPassword || customerPassword.length < 6) {
        return NextResponse.json({ error: "Customer password must be at least 6 characters" }, { status: 400 });
      }

      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email: customerEmail,
        password: customerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: customerName || account.name,
        },
      });

      if (userError || !userData?.user) {
        console.error("[PATCH /api/account/tenants] createUser error:", userError);
        return NextResponse.json({ error: userError?.message || "Failed to create customer user account" }, { status: 400 });
      }

      // Re-assign profile to target account
      const { data: profile } = await admin
        .from("profiles")
        .select("id, account_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      const oldAccountId = profile?.account_id;

      await admin
        .from("profiles")
        .update({
          account_id: accountId,
          account_role: "admin",
        })
        .eq("user_id", userData.user.id);

      if (oldAccountId && oldAccountId !== accountId) {
        await admin
          .from("accounts")
          .delete()
          .eq("id", oldAccountId)
          .eq("owner_user_id", userData.user.id);
      }

      return NextResponse.json({
        ok: true,
        customer: { id: userData.user.id, email: userData.user.email },
      });
    }

    // Action 3: Configure/update WhatsApp API credentials directly for this tenant
    if (action === "update_whatsapp") {
      const phoneNumberId = typeof body?.phone_number_id === "string" ? body.phone_number_id.trim() : "";
      const wabaId = typeof body?.waba_id === "string" ? body.waba_id.trim() : "";
      const accessToken = typeof body?.access_token === "string" ? body.access_token.trim() : "";

      if (!phoneNumberId || !accessToken) {
        return NextResponse.json({ error: "phone_number_id and access_token are required" }, { status: 400 });
      }

      const encryptedAccessToken = encrypt(accessToken);
      const verifyToken = crypto.randomBytes(24).toString("hex");
      const encryptedVerifyToken = encrypt(verifyToken);

      // Check if config exists
      const { data: existing } = await admin
        .from("whatsapp_config")
        .select("id")
        .eq("account_id", accountId)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await admin
          .from("whatsapp_config")
          .update({
            phone_number_id: phoneNumberId,
            waba_id: wabaId || null,
            access_token: encryptedAccessToken,
            status: "connected",
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);

        if (updErr) {
          console.error("[PATCH /api/account/tenants] update whatsapp error:", updErr);
          return NextResponse.json({ error: updErr.message || "Failed to update WhatsApp config" }, { status: 400 });
        }
      } else {
        const { error: insErr } = await admin.from("whatsapp_config").insert({
          account_id: accountId,
          user_id: ctx.userId,
          phone_number_id: phoneNumberId,
          waba_id: wabaId || null,
          access_token: encryptedAccessToken,
          verify_token: encryptedVerifyToken,
          status: "connected",
          connected_at: new Date().toISOString(),
        });

        if (insErr) {
          console.error("[PATCH /api/account/tenants] insert whatsapp error:", insErr);
          return NextResponse.json({ error: insErr.message || "Failed to save WhatsApp config" }, { status: 400 });
        }
      }

      return NextResponse.json({
        ok: true,
        whatsapp: {
          phone_number_id: phoneNumberId,
          waba_id: wabaId || null,
          status: "connected",
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = await request.json().catch(() => null);
    const accountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";
    if (!accountId) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase.rpc("switch_account", { target_account_id: accountId });
    if (error) {
      console.error("[PUT /api/account/tenants] rpc error:", error);
      return NextResponse.json({ error: error.message || "Failed to switch tenant" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, active: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const accountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";
    if (!accountId) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const { error } = await ctx.supabase.rpc("delete_tenant", { target_account_id: accountId });
    if (error) {
      console.error("[DELETE /api/account/tenants] rpc error:", error);
      return NextResponse.json({ error: error.message || "Failed to delete tenant" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
