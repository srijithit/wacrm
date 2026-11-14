import { NextResponse } from "next/server";
import { getCurrentAccount, requireRole, toErrorResponse } from "@/lib/auth/account";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase.rpc("list_tenants");
    if (error) {
      console.error("[GET /api/account/tenants] rpc error:", error);
      return NextResponse.json({ error: "Failed to list tenants" }, { status: 500 });
    }
    return NextResponse.json({ tenants: data ?? [] });
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
      return NextResponse.json({ error: "Tenant name is required" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase.rpc("create_tenant", { p_name: name });
    if (error) {
      console.error("[POST /api/account/tenants] rpc error:", error);
      return NextResponse.json({ error: error.message || "Failed to create tenant" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, tenant: data });
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
