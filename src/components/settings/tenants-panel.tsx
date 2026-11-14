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
}

export function TenantsPanel() {
  const { accountId, refreshProfile, canEditSettings } = useAuth();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [creating, setCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    const trimmed = newTenantName.trim();
    if (!trimmed) {
      toast.error('Please enter a tenant organization name');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/account/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Tenant "${trimmed}" created successfully!`);
        setNewTenantName('');
        setCreateOpen(false);
        await refreshProfile();
        window.location.reload();
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
    if (!confirm(`Are you sure you want to delete tenant "${targetName}"? This cannot be undone.`)) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SettingsPanelHead
          title="Multi-Tenant Organizations"
          description="Manage multiple client accounts, brand workspaces, or subsidiaries under your admin profile. Each tenant has an isolated WhatsApp connection, contacts, inbox, and pipeline."
        />
        {canEditSettings && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
            <Plus className="size-4" />
            Create Tenant
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" />
            Your Tenants ({tenants.length})
          </CardTitle>
          <CardDescription>
            Click "Switch Workspace" to instantly switch your active organization and manage data for that tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" /> Loading tenants...
            </div>
          ) : tenants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No tenants found. Click "Create Tenant" above to add your first client organization.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {tenants.map((t) => {
                const isCurrent = t.is_current || t.id === accountId;
                const isBusy = switchingId === t.id || deletingId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      isCurrent ? 'bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
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
                            Owner
                          </span>
                        )}
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

                    <div className="flex items-center gap-2">
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                Create New Tenant Organization
              </DialogTitle>
              <DialogDescription>
                Add a new organization/client account. You will become the owner and can immediately connect its WhatsApp number and invite client team members.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Organization / Tenant Name</Label>
                <Input
                  id="tenant-name"
                  placeholder="e.g. Royaal Retail, Client ABC, Support Team"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  disabled={creating}
                  autoFocus
                />
              </div>
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
                Create & Switch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
