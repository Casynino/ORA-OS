import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import {
  MessagesInbox,
  type MessageDTO,
} from "@/components/admin/messages-inbox";

export default async function AdminMessagesPage() {
  await requireRole("ADMIN");
  const rows = await prisma.contactMessage.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { sender: { select: { name: true, organization: true } } },
  });
  const messages: MessageDTO[] = rows.map((m) => ({
    id: m.id,
    sender: m.sender.name,
    org: m.sender.organization,
    subject: m.subject,
    body: m.body,
    status: m.status,
    reply: m.reply,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Messages from partners to the ORA team. Reply to resolve each one."
      />
      <MessagesInbox messages={messages} />
    </div>
  );
}
