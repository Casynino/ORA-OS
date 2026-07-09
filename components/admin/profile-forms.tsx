"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, Loader2, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import {
  updateMyProfile,
  changeMyPassword,
  signOutAllDevices,
} from "@/lib/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    preferredName: string;
    email: string;
    phone: string;
    position: string;
    avatar: string;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState(initial);
  const set =
    (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setF((s) => ({ ...s, avatar: data.url }));
        toast({ variant: "success", title: "Photo uploaded — save to apply." });
      } else toast({ variant: "error", title: data.error ?? "Upload failed." });
    } catch {
      toast({ variant: "error", title: "Upload failed." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function submit() {
    start(async () => {
      const res = await updateMyProfile(f);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="space-y-4">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <Avatar name={f.name} src={f.avatar || null} className="size-16 text-lg" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          {f.avatar ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickPhoto}
            disabled={uploading}
          />
        </label>
        {f.avatar && (
          <button
            type="button"
            onClick={() => setF((s) => ({ ...s, avatar: "" }))}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Full name</Label>
          <Input value={f.name} onChange={set("name")} className="mt-1.5" />
        </div>
        <div>
          <Label>Preferred name / nickname</Label>
          <Input
            value={f.preferredName}
            onChange={set("preferredName")}
            className="mt-1.5"
            placeholder="e.g. Recy"
          />
        </div>
        <div>
          <Label>Email address</Label>
          <Input type="email" value={f.email} onChange={set("email")} className="mt-1.5" />
        </div>
        <div>
          <Label>Phone number</Label>
          <Input value={f.phone} onChange={set("phone")} className="mt-1.5" placeholder="+255 …" />
        </div>
      </div>
      <div>
        <Label>Position / title</Label>
        <Input
          value={f.position}
          onChange={set("position")}
          className="mt-1.5"
          placeholder="Chief Administrator"
        />
      </div>

      <Button
        className="rounded-full"
        disabled={pending || uploading || f.name.trim().length < 2}
        onClick={submit}
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Changes apply everywhere instantly — greeting, navigation, activity logs.
      </p>
    </div>
  );
}

export function PasswordForm() {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  function submit() {
    if (next !== confirm) {
      toast({ variant: "error", title: "New passwords don't match." });
      return;
    }
    start(async () => {
      const res = await changeMyPassword({ current, next });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Current password</Label>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1.5" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>New password</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <Button
        variant="outline"
        className="rounded-full"
        disabled={pending || !current || next.length < 8}
        onClick={submit}
      >
        <KeyRound className="size-4" />
        {pending ? "Changing…" : "Change password"}
      </Button>
    </div>
  );
}

export function SignOutEverywhereButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            "Sign out of ALL devices? Every session — including this one — will end.",
          )
        )
          return;
        start(async () => {
          const res = await signOutAllDevices();
          if (res.ok) {
            toast({ variant: "success", title: res.message });
            await logoutAction();
          } else toast({ variant: "error", title: res.error });
        });
      }}
    >
      <LogOut className="size-4" />
      {pending ? "Signing out…" : "Sign out of all devices"}
    </Button>
  );
}
