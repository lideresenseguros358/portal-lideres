import RenovacionesInbox from '@/components/operaciones/renovaciones/RenovacionesInbox';

export default async function OperacionesRenovacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const params = await searchParams;
  return <RenovacionesInbox initialCaseId={params.case} />;
}
