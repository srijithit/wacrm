'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Check,
  ArrowRightLeft,
  Trash2,
  UsersRound,
  Calendar,
  ShieldCheck,
  Loader2,
  KeyRound,
  Mail,
  User,
  Eye,
  EyeOff,
  Phone,
  MessageCircle,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsPanelHead } from './settings-panel-head';

interface TenantItem {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  is_current: boolean;
  is_owner: boolean;
  member_count: number;
  customer_email: string | null;
  customer_name: string | null;
  customer_user_id: string | null;
  customer_role: string | null;
  whatsapp: {
    configured: boolean;
    phone_number_id: string | null;
    waba_id: string | null;
    status: string;
    connected_at: string | null;
  };
}

export function TenantsPanel() {
  const { accountId, refreshProfile, canEditSettings } = useAuth();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Tenant Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPassword, setNewCustomerPassword] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showWhatsAppFields, setShowWhatsAppFields] = useState(false);
  const [newPhoneNumberId, setNewPhoneNumberId] = useState('');
  const [newWabaId, setNewWabaId] = useState('');
  const [newAccessToken, setNewAccessToken] = useState('');
  const [switchImmediately, setSwitchImmediately] = useState(false);
  const [creating, setCreating] = useState(false);

  // Operational State
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Manage WhatsApp Dialog
  const [waModalTenant, setWaModalTenant] = useState<TenantItem | null>(null);
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waWabaId, setWaWabaId] = useState('');
  const [waAccessToken, setWaAccessToken] = useState('');
  const [waSaving, setWaSaving] = useState(false);

  // Password / User Modal
  const [pwdModalTenant, setPwdModalTenant] = useState<TenantItem | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [userModalEmail, setUserModalEmail] = useState('');
  const [userModalPassword, setUserModalPassword] = useState('');
  const [userModalName, setUserModalName] = useState('');
  const [showUserModalPassword, setShowUserModalPassword] = useState(false);
  const [userSaving, setUserSaving] = useState(false);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/account/tenants', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setTenants(data.tenants ?? []);
      } else {
        toast.error(data.error ?? 'Failed to load tenants');
      }
    } catch {
      toast.error('Network error loading tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTenants();
  }, [accountId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newTenantName.trim();
    if (!trimmedName) {
      toast.error('Please enter a tenant organization name');
      return;
    }

    const trimmedEmail = newCustomerEmail.trim().toLowerCase();
    if (trimmedEmail && (!newCustomerPassword || newCustomerPassword.length < 6)) {
      toast.error('Customer login password must be at least 6 characters');
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: trimmedName,
        customer_email: trimmedEmail || undefined,
        customer_password: newCustomerPassword || undefined,
        customer_name: newCustomerName.trim() || undefined,
        switch_immediately: switchImmediately,
      };

      if (newPhoneNumberId.trim() && newAccessToken.trim()) {
        payload.whatsapp = {
          phone_number_id: newPhoneNumberId.trim(),
          waba_id: newWabaId.trim() || undefined,
          access_token: newAccessToken.trim(),
        };
      }

      const res = await fetch('/api/account/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(
          trimmedEmail
            ? `Tenant "${trimmedName}" created with login for ${trimmedEmail}!`
            : `Tenant "${trimmedName}" created successfully!`,
        );
        // Reset form
        setNewTenantName('');
        setNewCustomerEmail('');
        setNewCustomerPassword('');
        setNewCustomerName('');
        setNewPhoneNumberId('');
        setNewWabaId('');
        setNewAccessToken('');
        setShowWhatsAppFields(false);
        setCreateOpen(false);

        if (switchImmediately) {
          await refreshProfile();
          window.location.reload();
        } else {
          await fetchTenants();
        }
      } else {
        toast.error(data.error ?? 'Failed to create tenant');
      }
    } catch {
      toast.error('Network error creating tenant');
    } finally {
      setCreating(false);
    }
  };

  const handleSwitch = async (targetId: string, targetName: string) => {
    if (targetId === accountId) return;
    setSwitchingId(targetId);
    try {
      const res = await fetch('/api/account/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Switched active workspace to "${targetName}"`);
        await refreshProfile();
        window.location.reload();
      } else {
        toast.error(data.error ?? 'Failed to switch tenant');
      }
    } catch {
      toast.error('Network error switching tenant');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDelete = async (targetId: string, targetName: string) => {
    if (!confirm(`Are you sure you want to delete tenant "${targetName}"? All contacts, conversations, and data under this tenant will be permanently removed.`)) {
      return;
    }
    setDeletingId(targetId);
    try {
      const res = await fetch('/api/account/tenants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Tenant "${targetName}" removed`);
        await refreshProfile();
        await fetchTenants();
      } else {
        toast.error(data.error ?? 'Failed to delete tenant');
      }
    } catch {
      toast.error('Network error deleting tenant');
    } finally {
      setDeletingId(null);
    }
  };

  // Open WhatsApp configuration modal for a specific tenant
  const openWhatsAppModal = (tenant: TenantItem) => {
    setWaModalTenant(tenant);
    setWaPhoneNumberId(tenant.whatsapp?.phone_number_id ?? '');
    setWaWabaId(tenant.whatsapp?.waba_id ?? '');
    setWaAccessToken('');
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waModalTenant) return;
    if (!waPhoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (!waAccessToken.trim()) {
      toast.error('Meta Permanent Access Token is required');
      return;
    }

    setWaSaving(true);
    try {
      const res = await fetch('/api/account/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: waModalTenant.id,
          action: 'update_whatsapp',
          phone_number_id: waPhoneNumberId.trim(),
          waba_id: waWabaId.trim() || undefined,
          access_token: waAccessToken.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`WhatsApp API credentials saved for "${waModalTenant.name}"!`);
        setWaModalTenant(null);
        await fetchTenants();
      } else {
        toast.error(data.error ?? 'Failed to save WhatsApp config');
      }
    } catch {
      toast.error('Network error saving WhatsApp config');
    } finally {
      setWaSaving(false);
    }
  };

  // Open password or customer user modal
  const openUserModal = (tenant: TenantItem) => {
    setPwdModalTenant(tenant);
    setTargetUserId(tenant.customer_user_id ?? '');
    setUserModalEmail(tenant.customer_email ?? '');
    setUserModalPassword('');
    setUserModalName(tenant.customer_name ?? '');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdModalTenant) return;

    if (!userModalPassword || userModalPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setUserSaving(true);
    try {
      let res: Response;
      if (targetUserId) {
        // Reset password for existing user
        res = await fetch('/api/account/tenants', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: pwdModalTenant.id,
            action: 'set_customer_password',
            user_id: targetUserId,
            new_password: userModalPassword,
          }),
        });
      } else {
        // Create new customer user for tenant
        if (!userModalEmail.trim()) {
          toast.error('Customer email is required');
          setUserSaving(false);
          return;
        }
        res = await fetch('/api/account/tenants', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: pwdModalTenant.id,
            action: 'create_customer_user',
            customer_email: userModalEmail.trim(),
            customer_password: userModalPassword,
            customer_name: userModalName.trim() || undefined,
          }),
        });
      }

      const data = await res.json();
      if (res.ok) {
        toast.success(
          targetUserId
            ? `Password updated successfully for ${userModalEmail}!`
            : `Customer user created successfully!`,
        );
        setPwdModalTenant(null);
        await fetchTenants();
      } else {
        toast.error(data.error ?? 'Failed to update customer user');
      }
    } catch {
      toast.error('Network error updating user');
    } finally {
      setUserSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SettingsPanelHead
          title="Multi-Tenant SaaS Organizations"
          description="Provision client customer accounts, manage login credentials, and configure isolated WhatsApp Meta APIs for each client tenant."
        />
        {canEditSettings && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
            <Plus className="size-4" />
            Create Customer Tenant
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" />
            Client Tenants & Workspaces ({tenants.length})
          </CardTitle>
          <CardDescription>
            Each client tenant has an isolated WhatsApp connection, contacts, inbox, and pipeline. Customers can sign in at the login page using their email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" /> Loading tenant organizations...
            </div>
          ) : tenants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No client tenants found. Click &quot;Create Customer Tenant&quot; above to add your first customer.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {tenants.map((t) => {
                const isCurrent = t.is_current || t.id === accountId;
                const isBusy = switchingId === t.id || deletingId === t.id;
                const hasWhatsApp = t.whatsapp?.configured;

                return (
                  <div
                    key={t.id}
                    className={`flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      isCurrent ? 'bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-base">
                          {t.name}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Check className="size-3" />
                            Active Workspace
                          </span>
                        )}
                        {t.is_owner && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            <ShieldCheck className="size-3" />
                            Admin Owner
                          </span>
                        )}
                      </div>

                      {/* Customer Login Info & Meta Status */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        {t.customer_email ? (
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Mail className="size-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Login: <strong className="font-mono">{t.customer_email}</strong></span>
                            <button
                              type="button"
                              onClick={() => openUserModal(t)}
                              className="ml-1 text-[11px] text-primary underline hover:text-primary/80"
                            >
                              Reset Password
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="size-3.5" />
                            <span>No customer login assigned</span>
                            <button
                              type="button"
                              onClick={() => openUserModal(t)}
                              className="ml-1 text-[11px] font-semibold text-primary underline hover:text-primary/80"
                            >
                              + Assign Login
                            </button>
                          </div>
                        )}

                        {/* WhatsApp Meta API Status */}
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="size-3.5 text-green-600 dark:text-green-400" />
                          {hasWhatsApp ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 text-green-700 dark:text-green-300">
                              <span className="size-1.5 rounded-full bg-green-500" />
                              WhatsApp ID: <code className="font-mono">{t.whatsapp.phone_number_id}</code>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                              <AlertCircle className="size-3" />
                              Meta API Not Configured
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <UsersRound className="size-3.5" />
                          {t.member_count} {t.member_count === 1 ? 'member' : 'members'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3.5" />
                          Created {new Date(t.created_at).toLocaleDateString()}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground/70">
                          ID: {t.id}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Quick Meta API Configure Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openWhatsAppModal(t)}
                        className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/30"
                      >
                        <Phone className="size-3.5" />
                        {hasWhatsApp ? 'Edit Meta API' : 'Connect WhatsApp'}
                      </Button>

                      {/* Switch Workspace Button */}
                      {isCurrent ? (
                        <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-80">
                          <Check className="size-3.5 text-primary" />
                          Current
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleSwitch(t.id, t.name)}
                          className="gap-1.5 hover:bg-primary hover:text-primary-foreground"
                        >
                          {switchingId === t.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="size-3.5" />
                          )}
                          Switch Workspace
                        </Button>
                      )}

                      {/* Delete Tenant Button */}
                      {t.is_owner && !isCurrent && tenants.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleDelete(t.id, t.name)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingId === t.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE TENANT + CUSTOMER LOGIN DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                Create Customer Tenant Organization
              </DialogTitle>
              <DialogDescription>
                Provision a new customer workspace with their own login credentials and dedicated WhatsApp Meta Cloud API connection.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* Tenant Name */}
              <div className="space-y-2">
                <Label htmlFor="tenant-name" className="font-semibold">
                  Customer / Organization Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tenant-name"
                  placeholder="e.g. Acme Corp, Dr. Clinic, Client Brand"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  disabled={creating}
                  required
                  autoFocus
                />
              </div>

              {/* Customer Login Section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <User className="size-4 text-primary" />
                  <span>Customer Login Credentials</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create the email and password the customer will use to sign in to Royaal CRM at the login page.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-email" className="text-xs">
                      Customer Email / Username <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="client@example.com"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      disabled={creating}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="customer-name" className="text-xs">
                      Customer Full Name (Optional)
                    </Label>
                    <Input
                      id="customer-name"
                      placeholder="e.g. John Doe"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customer-password" className="text-xs">
                    Initial Password (min 6 characters) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="customer-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter secure password"
                      value={newCustomerPassword}
                      onChange={(e) => setNewCustomerPassword(e.target.value)}
                      disabled={creating}
                      minLength={6}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible WhatsApp Meta API Section */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Phone className="size-4 text-green-600 dark:text-green-400" />
                    <span>WhatsApp Meta Cloud API (Optional upfront)</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowWhatsAppFields(!showWhatsAppFields)}
                    className="text-xs text-primary"
                  >
                    {showWhatsAppFields ? 'Hide' : '+ Configure Now'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can enter their WhatsApp API credentials now, or configure them later via the &quot;Connect WhatsApp&quot; button.
                </p>

                {showWhatsAppFields && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="wa-phone-id" className="text-xs">
                        Phone Number ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="wa-phone-id"
                        placeholder="e.g. 104829104812345"
                        value={newPhoneNumberId}
                        onChange={(e) => setNewPhoneNumberId(e.target.value)}
                        disabled={creating}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="wa-waba-id" className="text-xs">
                        WhatsApp Business Account ID (WABA ID)
                      </Label>
                      <Input
                        id="wa-waba-id"
                        placeholder="e.g. 948291048123456"
                        value={newWabaId}
                        onChange={(e) => setNewWabaId(e.target.value)}
                        disabled={creating}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="wa-token" className="text-xs">
                        Meta Permanent Access Token <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="wa-token"
                        type="password"
                        placeholder="EAAB..."
                        value={newAccessToken}
                        onChange={(e) => setNewAccessToken(e.target.value)}
                        disabled={creating}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Immediate switch checkbox */}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={switchImmediately}
                  onChange={(e) => setSwitchImmediately(e.target.checked)}
                  className="size-4 accent-primary rounded"
                />
                Switch to this workspace immediately after creation
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newTenantName.trim()}>
                {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Create Tenant & Provision User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIRECT WHATSAPP CONFIG MODAL */}
      <Dialog open={Boolean(waModalTenant)} onOpenChange={(open) => !open && setWaModalTenant(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveWhatsApp}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="size-5 text-green-600 dark:text-green-400" />
                WhatsApp API for &quot;{waModalTenant?.name}&quot;
              </DialogTitle>
              <DialogDescription>
                Configure the Meta WhatsApp Cloud API credentials for this tenant workspace.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="modal-wa-phone-id">
                  Phone Number ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="modal-wa-phone-id"
                  placeholder="e.g. 104829104812345"
                  value={waPhoneNumberId}
                  onChange={(e) => setWaPhoneNumberId(e.target.value)}
                  disabled={waSaving}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-wa-waba-id">
                  WhatsApp Business Account ID (WABA ID)
                </Label>
                <Input
                  id="modal-wa-waba-id"
                  placeholder="e.g. 948291048123456"
                  value={waWabaId}
                  onChange={(e) => setWaWabaId(e.target.value)}
                  disabled={waSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-wa-token">
                  Meta Permanent Access Token <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="modal-wa-token"
                  type="password"
                  placeholder="EAAB..."
                  value={waAccessToken}
                  onChange={(e) => setWaAccessToken(e.target.value)}
                  disabled={waSaving}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  The access token is encrypted at rest using AES-256-GCM before storage.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWaModalTenant(null)}
                disabled={waSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={waSaving || !waPhoneNumberId.trim() || !waAccessToken.trim()}>
                {waSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Save WhatsApp Credentials
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PASSWORD / USER MODAL */}
      <Dialog open={Boolean(pwdModalTenant)} onOpenChange={(open) => !open && setPwdModalTenant(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveUser}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                {targetUserId ? 'Reset Customer Password' : 'Assign Customer Login'}
              </DialogTitle>
              <DialogDescription>
                {targetUserId
                  ? `Set a new password for ${userModalEmail} on "${pwdModalTenant?.name}".`
                  : `Create a login user for "${pwdModalTenant?.name}".`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {!targetUserId && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modal-user-email">
                      Customer Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="modal-user-email"
                      type="email"
                      placeholder="client@example.com"
                      value={userModalEmail}
                      onChange={(e) => setUserModalEmail(e.target.value)}
                      disabled={userSaving}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-user-name">
                      Customer Full Name (Optional)
                    </Label>
                    <Input
                      id="modal-user-name"
                      placeholder="e.g. Jane Doe"
                      value={userModalName}
                      onChange={(e) => setUserModalName(e.target.value)}
                      disabled={userSaving}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="modal-user-password">
                  {targetUserId ? 'New Password (min 6 characters)' : 'Password (min 6 characters)'}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="modal-user-password"
                    type={showUserModalPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={userModalPassword}
                    onChange={(e) => setUserModalPassword(e.target.value)}
                    disabled={userSaving}
                    minLength={6}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserModalPassword(!showUserModalPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showUserModalPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwdModalTenant(null)}
                disabled={userSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={userSaving || userModalPassword.length < 6}>
                {userSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {targetUserId ? 'Update Password' : 'Create Customer User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
