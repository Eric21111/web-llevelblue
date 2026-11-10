import {useEffect, useId, useState} from "react";
import {ChartNoAxesColumnIncreasing, Layers} from "lucide-react";
import ChoicePicker from "./ChoicePicker";
import {SKILLS} from "../utils/dashboard";
import "../styles/student-mastery.css";

const levels = {
  support: "Needs support",
  developing: "Developing",
  strong: "Strong",
  unknown: "Not recorded",
};

function masteryLevel(value) {
  if (!Number.isFinite(value)) return "unknown";
  if (value < 0.4) return "support";
  return value >= 0.9 ? "strong" : "developing";
}

function displayMastery(value) {
  if (!Number.isFinite(value)) return "—";
  const percent = Math.round(value * 100);
  // Rounding close to a boundary must agree with the cell's support level.
  if (value < 0.4 && percent === 40) return "<40%";
  if (value < 0.9 && percent === 90) return "<90%";
  return percent + "%";
}

export default function StudentMastery({students, sectionName}) {
  const headingId = useId();
  // Start with one readable column on phones. An explicit choice always takes priority.
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 600px)").matches);
  const [chosenTopic, setTopic] = useState(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const resize = () => setCompact(media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  const topic = chosenTopic ?? (compact ? SKILLS[0] : "");
  const topics = topic ? [topic] : SKILLS;
  return (
    <section className="student-mastery" aria-labelledby={headingId}>
      <div className="mastery-heading">
        <div className="mastery-title"><span className="mastery-title-icon"><ChartNoAxesColumnIncreasing aria-hidden="true"/></span><div><h2 id={headingId}>Student mastery</h2><p>Estimated understanding, learner by learner.</p></div></div>
        {students.length > 0 && <ChoicePicker className="mastery-filter" label="Topic" value={topic} onChange={setTopic} options={[{value:"",label:"All topics",icon:Layers},...SKILLS.map(skill=>({value:skill,label:skill}))]}/>}
      </div>
      {!students.length ? <p>No learners in this selection. Choose another section or check your assignments.</p> : <>
        <div className="mastery-scroll" tabIndex={0} role="region" aria-label="Student mastery by topic">
          <table>
            <thead><tr><th scope="col">Student</th>{topics.map(skill => <th key={skill} scope="col">{skill}</th>)}</tr></thead>
            <tbody key={topic}>{students.map((student, rowIndex) => <tr key={student._id} style={{"--mastery-order":Math.min(rowIndex,5)}}>
              <th scope="row">{student.name}{(!sectionName || student.section !== sectionName) && <small>{student.section || "Unassigned"}</small>}</th>
              {topics.map(skill => {
                const value = student.mastery?.[skill];
                const level = masteryLevel(value);
                return <td key={skill}><span className={'mastery-value level-' + level}>
                  <span>{displayMastery(value)}</span>
                  <span className="dash-sr-only"> {levels[level]}</span>
                  {Number.isFinite(value) && <span className="mastery-meter" aria-hidden="true"><i style={{width:Math.max(0,Math.min(1,value))*100+"%"}}/></span>}
                </span></td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        <ul className="mastery-key" aria-label="Estimated mastery levels">
          <li className="level-support">Below 40% needs support</li>
          <li className="level-developing">40–89% developing</li>
          <li className="level-strong">90%+ strong</li>
          <li className="level-unknown">— Not recorded</li>
        </ul>
      </>}
    </section>
  );
}
