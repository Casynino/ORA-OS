"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Reply, CheckCircle2 } from "lucide-react";
import { replyContactMessage } from "@/lib/actions/contact";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/utils";

export type MessageDTO = {
  id: string;
  sender: string;
  org: string | null;
  subject: string | null;
  body: string;
  status: string;
  reply: string | null;
  createdAt: string;
};

const TABS = [
  { k: "OPEN", label: "Open" },
  { k: "RESOLVED", label: "Resolved" },
  { k: "ALL", label: "All" },
] as const;

export function MessagesInbox({ messages }: { messages: MessageDTO[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("OPEN");
  const [replyTo, setReplyTo] = useState<MessageDTO | null>(null);

  const filtered = useMemo(
    () => (tab === "ALL" ? messages : messages.filter((m) => m.status === tab)),
    [messages, tab],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const n =
            t.k === "ALL" ? messages.length : messages.filter((m) => m.status === t.k).length;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              <span className="ml-1.5 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No messages" description="Partner messages to the ORA team appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.sender}</span>
                      {m.org && <span className="text-xs text-muted-foreground">{m.org}</span>}
                      <StatusBadge status={m.status} />
                    </div>
                    {m.subject && <p className="mt-1 text-sm font-medium">{m.subject}</p>}
                    <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(m.createdAt)}</p>
                  </div>
                  {m.status === "OPEN" ? (
                    <Button size="sm" onClick={() => setReplyTo(m)}>
                      <Reply className="size-3.5" />
                      Reply
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="size-3.5" /> Resolved
                    </span>
                  )}
                </div>
                {m.reply && (
                  <div className="mt-3 rounded-md bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary">ORA team reply</p>
                    <p className="text-sm">{m.reply}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {replyTo && (
        <ReplyModal
          message={replyTo}
          onClose={() => setReplyTo(null)}
          onDone={() => {
            setReplyTo(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReplyModal({
  message,
  onClose,
  onDone,
}: {
  message: MessageDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [reply, setReply] = useState("");

  function submit() {
    if (reply.trim().length < 1) {
      toast({ variant: "error", title: "Write a reply." });
      return;
    }
    start(async () => {
      const res = await replyContactMessage({ id: message.id, reply });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal open onClose={onClose} title={`Reply to ${message.sender}`} description={message.subject ?? message.body}>
      <div className="space-y-4">
        <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" className="min-h-32" />
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : "Send reply & resolve"}
        </Button>
      </div>
    </Modal>
  );
}
