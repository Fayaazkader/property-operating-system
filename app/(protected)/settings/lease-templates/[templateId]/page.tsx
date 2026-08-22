import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{
    templateId: string;
  }>;
}

export default async function LeaseTemplatePage({
  params,
}: PageProps) {
  const { templateId } = await params;

  redirect(
    `/settings/lease-templates/${templateId}/review`
  );
}