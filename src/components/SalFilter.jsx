import { Seg } from './ui.jsx';
import { fmt } from '../lib/calc.js';

export default function SalFilter({ data, value, onChange, noAll }) {
  return (
    <Seg
      wrap
      value={value}
      onChange={onChange}
      options={[...(noAll ? [] : [{ v: 'ALL', label: 'Semua' }]), ...data.salesmen.map((s) => ({ v: s, label: fmt.short(s) }))]}
    />
  );
}
