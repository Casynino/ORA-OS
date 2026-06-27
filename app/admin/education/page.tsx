import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EducationManager } from "@/components/admin/education-manager";

export default async function AdminEducationPage() {
  const content = await prisma.educationContent.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const dto = content.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    language: c.language,
    published: c.published,
    readMinutes: c.readMinutes,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Education hub"
        description="Create and publish menstrual-health education in English and Kiswahili."
      />
      <EducationManager content={dto} />
    </div>
  );
}
