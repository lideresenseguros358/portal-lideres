import UrgenciasInbox from '@/components/operaciones/urgencias/UrgenciasInbox';

export default async function OperacionesUrgenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const params = await searchParams;
  return <UrgenciasInbox initialCaseId={params.case} />;
}
