export default function StageEvidence({record}){
 const d=record.data.details;
 if(!d)return <small>No detailed evidence received for this attempt.</small>;
 return <details><summary>Inspect attempt</summary><dl className="stage-evidence"><dt>Reported phase</dt><dd>{d.phase}</dd><dt>Base health remaining</dt><dd>{d.health}</dd>{d.answered!=null&&<><dt>Answers recorded</dt><dd>{d.correct??'Unknown'} correct / {d.answered} answered</dd></>}{d.waves_completed!=null&&<><dt>Defense waves completed</dt><dd>{d.waves_completed} / {d.waves_total}</dd></>}{d.timed_out&&<><dt>Timed question</dt><dd>A timeout was recorded</dd></>}</dl>{d.missed_question_ids?.length>0&&<p>Missed question references: {d.missed_question_ids.join(', ')}</p>}<p className="dash-footnote">Mobile-reported snapshot at the end of this attempt. Question references cover supported quiz scenes, at most 50 unique IDs. These details do not establish a single cause of failure.</p></details>;
}
