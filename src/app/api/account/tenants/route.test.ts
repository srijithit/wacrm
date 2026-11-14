import { beforeEach, describe, expect, it, vi } from "vitest";

let mockUser = { id: "admin-1", email: "admin@royaal.com" };
let mockAccountName = "Royaal Tech";
let mockRole: string | null = "admin";
let listTenantsResult: unknown[] = [];
let switchAccountResult: unknown = { ok: true };
let deleteTenantResult: unknown = true;

const createdAuthUsers: Array<{ email: string; password?: string; user_metadata?: Record<string, unknown> }> = [];
const accountsRows: Array<Record<string, unknown>> = [];
const profileRows: Array<Record<string, unknown>> = [];
const whatsappRows: Array<Record<string, unknown>> = [];

vi.mock("@/lib/auth/account", () => ({
  getCurrentAccount: vi.fn(async () => {
    if (!mockUser) {
      const err = new Error("Not signed in");
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    return {
      userId: mockUser.id,
      userEmail: mockUser.email,
      accountId: "acct-main",
      role: mockRole,
      account: { id: "acct-main", name: mockAccountName },
      supabase: {
        rpc: vi.fn(async (fn: string) => {
          if (fn === "list_tenants") return { data: listTenantsResult, error: null };
          if (fn === "switch_account") return { data: switchAccountResult, error: null };
          if (fn === "delete_tenant") return { data: deleteTenantResult, error: null };
          return { data: null, error: null };
        }),
      },
    };
  }),
  requireRole: vi.fn(async () => {
    if (!mockUser) {
      const err = new Error("Not signed in");
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    if (mockRole !== "admin" && mockRole !== "owner") {
      const err = new Error("Forbidden");
      (err as unknown as { status: number }).status = 403;
      throw err;
    }
    return {
      userId: mockUser.id,
      userEmail: mockUser.email,
      accountId: "acct-main",
      role: mockRole,
      account: { id: "acct-main", name: mockAccountName },
      supabase: {
        rpc: vi.fn(async (fn: string) => {
          if (fn === "list_tenants") return { data: listTenantsResult, error: null };
          if (fn === "switch_account") return { data: switchAccountResult, error: null };
          if (fn === "delete_tenant") return { data: deleteTenantResult, error: null };
          return { data: null, error: null };
        }),
      },
    };
  }),
  toErrorResponse: vi.fn((err: unknown) => {
    const status = (err as { status?: number })?.status ?? 500;
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ success: true })),
  rateLimitResponse: vi.fn(),
  RATE_LIMITS: { adminAction: {} },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(async (args: { email: string; password?: string; user_metadata?: Record<string, unknown> }) => {
          createdAuthUsers.push(args);
          return {
            data: { user: { id: `user-${createdAuthUsers.length}`, email: args.email } },
            error: null,
          };
        }),
        updateUserById: vi.fn(async (_userId: string, args: { password?: string }) => {
          return { data: { user: { id: _userId } }, error: null };
        }),
      },
    },
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = vi.fn(chain);
      builder.in = vi.fn(() => {
        if (table === "profiles") return { data: profileRows, error: null };
        if (table === "whatsapp_config") return { data: whatsappRows, error: null };
        return { data: [], error: null };
      });
      builder.eq = vi.fn((col: string, val: unknown) => {
        if (table === "accounts" && col === "id") {
          return {
            single: () => ({
              data: accountsRows.find((r) => r.id === val) ?? { id: val, name: "Acme" },
              error: null,
            }),
          };
        }
        if (table === "profiles" && col === "user_id") {
          return {
            maybeSingle: () => ({
              data: { id: "prof-1", account_id: "acct-dummy" },
              error: null,
            }),
          };
        }
        if (table === "whatsapp_config" && col === "account_id") {
          return {
            maybeSingle: () => ({
              data: whatsappRows.find((r) => r.account_id === val) ?? null,
              error: null,
            }),
          };
        }
        return builder;
      });
      builder.insert = vi.fn((row: Record<string, unknown>) => {
        if (table === "accounts") {
          const rec = { id: `tenant-${accountsRows.length + 1}`, ...row };
          accountsRows.push(rec);
          return {
            select: () => ({
              single: () => ({ data: rec, error: null }),
            }),
          };
        }
        if (table === "whatsapp_config") {
          whatsappRows.push(row);
          return { error: null };
        }
        return builder;
      });
      builder.update = vi.fn((patch: Record<string, unknown>) => {
        return {
          eq: () => ({ error: null }),
        };
      });
      builder.delete = vi.fn(() => {
        return {
          eq: () => ({
            eq: () => ({ error: null }),
          }),
        };
      });
      return builder;
    }),
  })),
}));

import { GET, POST, PUT, DELETE, PATCH } from "./route";

describe("Multi-Tenant SaaS /api/account/tenants", () => {
  beforeEach(() => {
    mockUser = { id: "admin-1", email: "admin@royaal.com" };
    mockAccountName = "Royaal Tech";
    mockRole = "admin";
    listTenantsResult = [
      {
        id: "acct-main",
        name: "Royaal Tech",
        owner_user_id: "admin-1",
        created_at: new Date().toISOString(),
        is_current: true,
        is_owner: true,
        member_count: 1,
      },
    ];
    createdAuthUsers.length = 0;
    accountsRows.length = 0;
    profileRows.length = 0;
    whatsappRows.length = 0;
  });

  it("GET /api/account/tenants enriches tenants with customer and WhatsApp metadata", async () => {
    profileRows.push({
      id: "p-1",
      user_id: "user-cust-1",
      email: "client@clientbrand.com",
      full_name: "Client Admin",
      account_id: "acct-main",
      account_role: "admin",
    });
    whatsappRows.push({
      account_id: "acct-main",
      phone_number_id: "99887766",
      waba_id: "112233",
      status: "connected",
      connected_at: new Date().toISOString(),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0]).toMatchObject({
      name: "Royaal Tech",
      customer_email: "client@clientbrand.com",
      whatsapp: {
        configured: true,
        phone_number_id: "99887766",
        status: "connected",
      },
    });
  });

  it("POST /api/account/tenants validates tenant name", async () => {
    const req = new Request("http://localhost/api/account/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Tenant organization name is required");
  });

  it("POST /api/account/tenants validates customer email and password requirements", async () => {
    const req = new Request("http://localhost/api/account/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Acme Client",
        customer_email: "invalid-email",
        customer_password: "123",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("valid customer email address");
  });

  it("POST /api/account/tenants provisions customer user and tenant workspace with WhatsApp credentials", async () => {
    const req = new Request("http://localhost/api/account/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Acme Global",
        customer_email: "client@acme.com",
        customer_password: "SecurePassword123!",
        customer_name: "Acme Administrator",
        whatsapp: {
          phone_number_id: "1029384756",
          waba_id: "5544332211",
          access_token: "EAAB_test_token_12345",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tenant.name).toBe("Acme Global");
    expect(body.customer).toEqual({
      id: "user-1",
      email: "client@acme.com",
    });
    expect(createdAuthUsers).toHaveLength(1);
    expect(createdAuthUsers[0]).toMatchObject({
      email: "client@acme.com",
      password: "SecurePassword123!",
    });
    expect(whatsappRows).toHaveLength(1);
    expect(whatsappRows[0]).toMatchObject({
      phone_number_id: "1029384756",
      waba_id: "5544332211",
    });
  });

  it("PATCH /api/account/tenants updates customer password", async () => {
    const req = new Request("http://localhost/api/account/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: "tenant-1",
        action: "set_customer_password",
        user_id: "user-1",
        new_password: "NewSuperPassword123!",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toContain("Password updated successfully");
  });

  it("PATCH /api/account/tenants updates WhatsApp Meta API configuration directly", async () => {
    const req = new Request("http://localhost/api/account/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: "tenant-1",
        action: "update_whatsapp",
        phone_number_id: "99881122",
        waba_id: "77665544",
        access_token: "EAAB_new_token",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.whatsapp.phone_number_id).toBe("99881122");
  });

  it("PUT /api/account/tenants switches active workspace", async () => {
    const req = new Request("http://localhost/api/account/tenants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: "tenant-target" }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("DELETE /api/account/tenants removes tenant", async () => {
    const req = new Request("http://localhost/api/account/tenants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: "tenant-target" }),
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("GET /api/account/tenants returns empty list for customer (non-platform admin)", async () => {
    mockUser = { id: "customer-1", email: "customer@client.com" };
    mockAccountName = "Client Workspace";
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenants).toEqual([]);
  });

  it("POST /api/account/tenants returns 403 for customer (non-platform admin)", async () => {
    mockUser = { id: "customer-1", email: "customer@client.com" };
    mockAccountName = "Client Workspace";
    const req = new Request("http://localhost/api/account/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked Org" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("platform administrators");
  });
});
