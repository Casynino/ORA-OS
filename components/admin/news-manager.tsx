"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Newspaper, Eye, EyeOff, Trash2, Upload, Loader2 } from "lucide-react";
import {
  createNews,
  toggleNewsPublished,
  deleteNews,
} from "@/lib/actions/news";
import { ActionButton } from "@/components/dashboard/action-button";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { humanize } from "@/lib/utils";

type Post = {
  id: string;
  title: string;
  category: string;
  published: boolean;
  publishedAt: string;
  coverImage: string | null;
};

export function NewsManager({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Newspaper className="size-4" />
          New post
        </Button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {posts.length === 0 ? (
            <EmptyState
              className="m-6"
              icon={Newspaper}
              title="No posts yet"
              description="Publish your first news post or announcement."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p.coverImage && (
                            <Image
                              src={p.coverImage}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <span className="font-medium">{p.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="accent">{humanize(p.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.publishedAt}
                    </TableCell>
                    <TableCell>
                      {p.published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          size="sm"
                          variant="outline"
                          action={() => toggleNewsPublished(p.id)}
                          onDone={() => router.refresh()}
                          pendingText="…"
                        >
                          {p.published ? (
                            <>
                              <EyeOff className="size-3.5" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="size-3.5" />
                              Publish
                            </>
                          )}
                        </ActionButton>
                        <ActionButton
                          size="sm"
                          variant="ghost"
                          action={() => deleteNews(p.id)}
                          onDone={() => router.refresh()}
                          confirm="Delete this post permanently?"
                          pendingText="…"
                        >
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {open && (
        <NewPostModal
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function NewPostModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    body: "",
    category: "NEWS",
    coverImage: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
        set("coverImage", data.url);
        toast({ variant: "success", title: "Photo uploaded." });
      } else {
        toast({ variant: "error", title: data.error ?? "Upload failed." });
      }
    } catch {
      toast({ variant: "error", title: "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    start(async () => {
      const res = await createNews({
        title: form.title,
        excerpt: form.excerpt,
        body: form.body,
        category: form.category as "NEWS" | "ANNOUNCEMENT" | "EVENT" | "STORY",
        coverImage: form.coverImage || undefined,
        published: true,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="New news post">
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="mt-1.5"
            placeholder="ORA-Pads reaches 5,000 girls in Mwanza"
          />
        </div>
        <div>
          <Label>Short summary</Label>
          <Input
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            className="mt-1.5"
            placeholder="One sentence shown in the news list."
          />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            className="mt-1.5 min-h-[140px]"
            placeholder="Separate paragraphs with a blank line."
          />
        </div>
        <div>
          <Label>Category</Label>
          <Select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="mt-1.5"
          >
            <option value="NEWS">News</option>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="EVENT">Event</option>
            <option value="STORY">Story</option>
          </Select>
        </div>

        {/* Photo */}
        <div>
          <Label>Cover photo</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickImage}
          />
          {form.coverImage ? (
            <div className="mt-1.5 flex items-center gap-3">
              <div className="relative size-20 overflow-hidden rounded-lg ring-1 ring-border">
                <Image
                  src={form.coverImage}
                  alt="cover preview"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                Replace
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-1.5 w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload photo
                </>
              )}
            </Button>
          )}
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={pending || uploading}
        >
          {pending ? "Publishing…" : "Publish post"}
        </Button>
      </div>
    </Modal>
  );
}
