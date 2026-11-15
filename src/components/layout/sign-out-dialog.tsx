"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

interface SignOutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
}

export function SignOutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: SignOutConfirmDialogProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleConfirm = async () => {
    try {
      setSigningOut(true);
      await onConfirm();
    } catch {
      setSigningOut(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !signingOut && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <LogOut className="size-5" />
            </div>
            <div className="space-y-1 text-left">
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={signingOut}
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg px-4 text-sm font-medium"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={signingOut}
            onClick={handleConfirm}
            className="h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600/30"
          >
            {signingOut ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                <span>{confirmLabel}</span>
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
