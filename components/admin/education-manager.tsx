"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, Eye, EyeOff } from "lucide-react";
import { createContent, toggleContentPublished } from "@/lib/actions/education";
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

type Content = {
  id: string;
  title: string;
  category: string;
  language: string;
  published: boolean;
  readMinutes: number;
};

export function EducationManager({ content }: { content: Content[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <BookPlus className="size-4" />
          New article
        </Button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {content.length === 0 ? (
            <EmptyState
              className="m-6"
              icon={BookPlus}
              title="No articles yet"
              description="Publish your first education article."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>
                      <Badge variant="accent">{humanize(c.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.language === "SW" ? "Kiswahili" : "English"}
                    </TableCell>
                    <TableCell>
                      {c.published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButton
                        size="sm"
                        variant="outline"
                        action={() => toggleContentPublished(c.id)}
                        onDone={() => router.refresh()}
                        pendingText="…"
                      >
                        {c.published ? (
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {open && (
        <NewArticleModal
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

function NewArticleModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    body: "",
    category: "MENSTRUAL_HEALTH",
    language: "EN",
    readMinutes: "3",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    start(async () => {
      const res = await createContent({
        title: form.title,
        excerpt: form.excerpt,
        body: form.body,
        category: form.category as
          | "MENSTRUAL_HEALTH"
          | "HYGIENE"
          | "MYTHS_FACTS"
          | "COMMUNITY_STORY"
          | "GENERAL",
        language: form.language as "EN" | "SW",
        readMinutes: Number(form.readMinutes) || 3,
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
    <Modal open onClose={onClose} title="New education article">
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Excerpt</Label>
          <Input
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            className="mt-1.5"
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
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="mt-1.5"
            >
              <option value="MENSTRUAL_HEALTH">Menstrual health</option>
              <option value="HYGIENE">Hygiene</option>
              <option value="MYTHS_FACTS">Myths vs facts</option>
              <option value="COMMUNITY_STORY">Community story</option>
              <option value="GENERAL">General</option>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Select
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
              className="mt-1.5"
            >
              <option value="EN">English</option>
              <option value="SW">Kiswahili</option>
            </Select>
          </div>
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Publishing…" : "Publish article"}
        </Button>
      </div>
    </Modal>
  );
}
