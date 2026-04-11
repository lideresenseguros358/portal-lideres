'use client';

import PeticionesInbox from './PeticionesInbox';

export default function OpsPeticionesTab({ initialCaseId }: { initialCaseId?: string }) {
  return <PeticionesInbox initialCaseId={initialCaseId} />;
}
