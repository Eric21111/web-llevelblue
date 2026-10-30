import { useId } from 'react';
import { TERMS } from '../utils/glossary';

export default function Term({ name, children }) {
  const id = useId();
  const text = TERMS[name];
  if (!text) return children;
  return <span className="lb-term"><button type="button" className="lb-term-button" aria-describedby={id}>{children}<span id={id} role="tooltip" className="lb-term-bubble">{text}</span></button></span>;
}
