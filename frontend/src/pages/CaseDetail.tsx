import { useParams } from 'react-router-dom';

export function CaseDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Case detail</h1>
      <p className="mt-2 text-sm text-slate">
        Case {id ? id.slice(0, 8) : ''} — detail coming in step 3.
      </p>
    </div>
  );
}
