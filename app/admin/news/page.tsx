import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { NewsManager } from "@/components/admin/news-manager";

export default async function AdminNewsPage() {
  const posts = await prisma.newsPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  const dto = posts.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    published: p.published,
    publishedAt: p.publishedAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    coverImage: p.coverImage,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="News & announcements"
        description="Post news, announcements and stories to the public site — add a photo and publish."
      />
      <NewsManager posts={dto} />
    </div>
  );
}
