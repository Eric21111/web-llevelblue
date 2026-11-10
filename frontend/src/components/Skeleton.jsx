export default function Skeleton({label='Loading workspace',rows=3}){
  return <div className="lb-skeleton" role="status" aria-label={label} aria-busy="true">
    {Array.from({length:rows},(_,i)=><span aria-hidden="true" key={i}/>)}
  </div>;
}
