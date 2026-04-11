import OpsPeticionesTab from '@/components/operaciones/peticiones/OpsPeticionesTab';

export default async function OperacionesPeticionesPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const params = await searchParams;
  return <OpsPeticionesTab initialCaseId={params.case} />;
}
