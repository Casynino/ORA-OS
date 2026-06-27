"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { sendContactMessage } from "@/lib/actions/contact";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

export function ContactOra() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function submit() {
    if (body.trim().length < 3) {
      toast({ variant: "error", title: "Write a short message." });
      return;
    }
    start(async () => {
      const res = await sendContactMessage({
        subject: subject || undefined,
        body,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setSubject("");
        setBody("");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <MessageSquare className="size-4" />
        Contact ORA
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Contact the ORA team"
          description="Send a message and the ORA team will get back to you here."
        >
          <div className="space-y-4">
            <div>
              <Label>Subject (optional)</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Delivery question"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="How can the ORA team help?"
                className="mt-1.5 min-h-28"
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Send message"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
