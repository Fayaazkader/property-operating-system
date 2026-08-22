import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { leaseTemplateService } from '@/lib/lease/templates/service';

interface PageProps {
  params: Promise<{
    templateId: string;
  }>;
}

export default async function LeaseTemplateReviewPage({
  params,
}: PageProps) {
  const { templateId } = await params;

  const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  notFound();
}

const { data: entities } = await supabase.rpc('auth_entities');
  const entityId = entities?.[0];

  if (!entityId) {
    notFound();
  }

  const template = await leaseTemplateService.getForReview(
    templateId,
    entityId
  );

  if (!template) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light text-white">
          Review Lease Template
        </h1>

        <p className="mt-1 text-sm text-zinc-500">
          {template.template_name} · v{template.version}
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] uppercase text-zinc-500">
              Category
            </p>
            <p className="mt-1 text-sm text-white capitalize">
              {template.category}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase text-zinc-500">
              Status
            </p>
            <p className="mt-1 text-sm text-amber-400">
              In Review
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase text-zinc-500">
              Applies To
            </p>
            <p className="mt-1 text-sm text-white">
              {template.applies_to_property_types.join(', ')}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-10 text-center">
        <p className="text-sm text-zinc-400">
          Review workspace loading...
        </p>
      </div>
    </div>
  );
}