"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  ImagePlus,
  X,
  Loader2,
} from "lucide-react";
import {
  createImpactActivity,
  updateImpactActivity,
  toggleImpactActivity,
  deleteImpactActivity,
  createImpactStory,
  toggleImpactStory,
  deleteImpactStory,
} from "@/lib/actions/impact";
import { ACTIVITY_TYPES, activityMeta } from "@/lib/impact-meta";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export type ActivityRow = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  location: string;
  region: string | null;
  district: string | null;
  partnerOrg: string | null;
  padsDistributed: number;
  peopleReached: number;
  images: string[];
  activityDate: Date;
  isPublished: boolean;
};

export type StoryRow = {
  id: string;
  title: string;
  personName: string | null;
  location: string | null;
  quote: string | null;
  published: boolean;
};

const emptyActivity = {
  title: "",
  type: "SCHOOL_VISIT",
  description: "",
  location: "",
  region: "",
  district: "",
  partnerOrg: "",
  pads: "",
  people: "",
  date: "",
  images: [] as string[],
};

function ActivityEditor({
  initial,
  id,
  onClose,
}: {
  initial: typeof emptyActivity;
  id?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState(initial);
  const set =
    (k: keyof typeof emptyActivity) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setF((s) => ({ ...s, images: [...s.images, data.url] }));
        toast({ variant: "success", title: "Photo added." });
      } else {
        toast({ variant: "error", title: data.error ?? "Upload failed." });
      }
    } catch {
      toast({ variant: "error", title: "Upload failed." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function submit() {
    const payload = {
      title: f.title,
      type: f.type as never,
      description: f.description,
      location: f.location,
      region: f.region,
      district: f.district,
      partnerOrg: f.partnerOrg,
      padsDistributed: Number(f.pads) || 0,
      peopleReached: Number(f.people) || 0,
      images: f.images,
      activityDate: f.date,
    };
    start(async () => {
      const res = id
        ? await updateImpactActivity(id, payload)
        : await createImpactActivity(payload);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onClose();
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={id ? "Edit activity" : "Record an activity"}
      description="Published activities appear on the public Impact page and update the counters instantly."
    >
      <div className="space-y-3.5">
        <div>
          <Label>Title</Label>
          <Input value={f.title} onChange={set("title")} className="mt-1.5" placeholder="e.g. Pad distribution at Mikocheni Secondary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={f.type} onChange={set("type")} className="mt-1.5">
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={f.date} onChange={set("date")} className="mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Location (school / community)</Label>
            <Input value={f.location} onChange={set("location")} className="mt-1.5" placeholder="e.g. Mikocheni Secondary School" />
          </div>
          <div>
            <Label>Region (optional)</Label>
            <Input value={f.region} onChange={set("region")} className="mt-1.5" placeholder="e.g. Dar es Salaam" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Pads distributed</Label>
            <Input type="number" min={0} value={f.pads} onChange={set("pads")} className="mt-1.5" placeholder="0" />
          </div>
          <div>
            <Label>People reached</Label>
            <Input type="number" min={0} value={f.people} onChange={set("people")} className="mt-1.5" placeholder="0" />
          </div>
        </div>
        <div>
          <Label>Partner organisation (optional)</Label>
          <Input value={f.partnerOrg} onChange={set("partnerOrg")} className="mt-1.5" />
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea value={f.description} onChange={set("description")} className="mt-1.5" rows={3} placeholder="What happened, and what did it change?" />
        </div>

        {/* Photos */}
        <div>
          <Label>Photos</Label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {f.images.map((img, i) => (
              <div key={`${img}-${i}`} className="relative size-16 overflow-hidden rounded-lg ring-1 ring-border">
                <Image src={img} alt="Activity photo" fill sizes="64px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => setF((s) => ({ ...s, images: s.images.filter((_, j) => j !== i) }))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label="Remove photo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              <input type="file" accept="image/*" className="hidden" onChange={onPickImage} disabled={uploading} />
            </label>
          </div>
        </div>

        <Button
          className="w-full rounded-full"
          disabled={pending || uploading || f.title.trim().length < 3 || f.location.trim().length < 2}
          onClick={submit}
        >
          {pending ? "Saving…" : id ? "Save changes" : "Publish activity"}
        </Button>
      </div>
    </Modal>
  );
}

function StoryEditor({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ title: "", personName: "", location: "", quote: "", body: "", pads: "", lives: "" });
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  function submit() {
    start(async () => {
      const res = await createImpactStory({
        title: f.title,
        personName: f.personName,
        location: f.location,
        quote: f.quote,
        body: f.body,
        padsDistributed: Number(f.pads) || 0,
        livesReached: Number(f.lives) || 0,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onClose();
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add an impact story"
      description="Real voices from schools and communities — shown on the public Impact page."
    >
      <div className="space-y-3.5">
        <div>
          <Label>Title</Label>
          <Input value={f.title} onChange={set("title")} className="mt-1.5" placeholder="e.g. Back in class at Temeke" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Person (optional)</Label>
            <Input value={f.personName} onChange={set("personName")} className="mt-1.5" placeholder="e.g. Neema, 15" />
          </div>
          <div>
            <Label>Location (optional)</Label>
            <Input value={f.location} onChange={set("location")} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label>Quote (optional)</Label>
          <Input value={f.quote} onChange={set("quote")} className="mt-1.5" placeholder="In their own words…" />
        </div>
        <div>
          <Label>Story</Label>
          <Textarea value={f.body} onChange={set("body")} className="mt-1.5" rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Pads involved (optional)</Label>
            <Input type="number" min={0} value={f.pads} onChange={set("pads")} className="mt-1.5" />
          </div>
          <div>
            <Label>Lives reached (optional)</Label>
            <Input type="number" min={0} value={f.lives} onChange={set("lives")} className="mt-1.5" />
          </div>
        </div>
        <Button
          className="w-full rounded-full"
          disabled={pending || f.title.trim().length < 3 || f.body.trim().length < 10}
          onClick={submit}
        >
          {pending ? "Saving…" : "Publish story"}
        </Button>
      </div>
    </Modal>
  );
}

export function ImpactManager({
  activities,
  stories,
}: {
  activities: ActivityRow[];
  stories: StoryRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [addingStory, setAddingStory] = useState(false);

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });

  return (
    <Tabs defaultValue="activities">
      <TabsList>
        <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
        <TabsTrigger value="stories">Stories ({stories.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="activities" className="mt-4 space-y-3">
        <div className="flex justify-end">
          <Button size="sm" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Record activity
          </Button>
        </div>
        {activities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Record your first community activity — it appears on the public Impact page instantly.
          </p>
        ) : (
          activities.map((a) => {
            const meta = activityMeta(a.type);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4",
                  a.isPublished ? "border-border" : "border-border/60 opacity-60",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {a.images[0] ? (
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
                      <Image src={a.images[0]} alt="" fill sizes="48px" className="object-cover" />
                    </div>
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
                      <meta.icon className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{a.title}</p>
                      <Badge variant="secondary">{meta.label}</Badge>
                      {!a.isPublished && <Badge variant="outline">Hidden</Badge>}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">
                        {a.location}
                        {a.region ? `, ${a.region}` : ""} · {formatDate(a.activityDate)} ·{" "}
                        {formatNumber(a.padsDistributed)} pads · {formatNumber(a.peopleReached)} reached
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                    disabled={pending}
                    onClick={() => act(() => toggleImpactActivity(a.id, !a.isPublished))}
                    title={a.isPublished ? "Hide from public page" : "Publish"}
                  >
                    {a.isPublished ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => setEditing(a)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Delete "${a.title}"?`)) act(() => deleteImpactActivity(a.id));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="stories" className="mt-4 space-y-3">
        <div className="flex justify-end">
          <Button size="sm" className="rounded-full" onClick={() => setAddingStory(true)}>
            <Plus className="size-4" />
            Add story
          </Button>
        </div>
        {stories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Add stories from the communities you serve.
          </p>
        ) : (
          stories.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4",
                s.published ? "border-border" : "border-border/60 opacity-60",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{s.title}</p>
                  {!s.published && <Badge variant="outline">Hidden</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {s.personName ?? "—"}
                  {s.location ? ` · ${s.location}` : ""}
                  {s.quote ? ` · “${s.quote.slice(0, 60)}${s.quote.length > 60 ? "…" : ""}”` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  disabled={pending}
                  onClick={() => act(() => toggleImpactStory(s.id, !s.published))}
                >
                  {s.published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Delete "${s.title}"?`)) act(() => deleteImpactStory(s.id));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </TabsContent>

      {adding && <ActivityEditor initial={emptyActivity} onClose={() => setAdding(false)} />}
      {editing && (
        <ActivityEditor
          id={editing.id}
          initial={{
            title: editing.title,
            type: editing.type,
            description: editing.description ?? "",
            location: editing.location,
            region: editing.region ?? "",
            district: editing.district ?? "",
            partnerOrg: editing.partnerOrg ?? "",
            pads: String(editing.padsDistributed || ""),
            people: String(editing.peopleReached || ""),
            date: editing.activityDate.toISOString().slice(0, 10),
            images: editing.images,
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {addingStory && <StoryEditor onClose={() => setAddingStory(false)} />}
    </Tabs>
  );
}
