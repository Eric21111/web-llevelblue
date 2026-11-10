import {useEffect, useRef, useState} from "react";
import {ArrowRight, BookOpen, ChartNoAxesColumnIncreasing, GraduationCap, Shield, ShieldCheck, ArrowDown, ArrowUp, Focus, ClipboardCheck, FileDown, Smartphone, ChevronDown, Mail, MessageSquare, Phone, UserRound, Gift, Users} from "lucide-react";
import FontImports from "../components/FontImports";
import StudentMastery from "../components/StudentMastery";
import ChoicePicker from "../components/ChoicePicker";
import {SKILLS, summarizeStudents} from "../utils/dashboard";
import "./LandingPage.css";

// Deliberately local examples. This public page never requests school records.
const sampleSections = [
  {grade: "Grade 11", section: "Diamond", rows: [
    ["A. Reyes", [0.93, 0.78, 0.64, 0.32, 0.81]],
    ["B. Cruz", [0.81, 0.91, null, 0.36, 0.75]],
    ["C. Santos", [0.95, 0.74, 0.68, 0.58, 0.92]],
    ["D. Torres", [0.88, 0.85, 0.72, 0.29, null]],
  ]},
  {grade: "Grade 12", section: "Emerald", rows: [
    ["E. Ramos", [0.96, 0.35, 0.74, 0.82, 0.91]],
    ["F. Lim", [0.87, 0.69, 0.93, 0.85, null]],
    ["G. Garcia", [0.92, 0.31, null, 0.79, 0.94]],
  ]},
].map(({grade, section, rows}) => ({
  label: grade + " · " + section,
  section,
  students: rows.map(([name, values]) => ({
    _id: name, name, section, mastery: Object.fromEntries(SKILLS.map((skill, index) => [skill, values[index]])),
  })),
}));

const roles = [
  {
    icon: GraduationCap, title: "Teachers", heading: "Plan the next lesson around your learners.",
    text: "Open your assigned sections, find topics that need practice, and keep a record of the support you provide.",
    tasks: [
      ["Class diagnostics", "Compare students and topics in the mastery heatmap."],
      ["Reviews & classroom support", "Record a learning review, schedule remediation, and update its outcome."],
      ["Individual reports", "Export recorded scores and progress for grading or parent conversations."],
    ],
  },
  {
    icon: BookOpen, title: "Head Admins", heading: "Teach your sections and support their faculty.",
    text: "Use the classroom tools for your own sections while checking the faculty assigned to them.",
    tasks: [
      ["Assigned classrooms", "Review your students’ mastery, assessment records, and feedback."],
      ["Section faculty", "See the staff connected to your assigned sections."],
      ["Teaching content", "Draft lessons, practice questions, and Threat Codex entries for Principal review."],
    ],
  },
  {
    icon: ShieldCheck, title: "Principal", heading: "Connect classroom needs to school decisions.",
    text: "Bring staff assignments, curriculum review, and school learning outcomes into one workspace.",
    tasks: [
      ["Staff & sections", "Create staff accounts and manage teaching assignments."],
      ["Review & publish", "Approve curriculum revisions before publishing them to the school content feed."],
      ["Institutional reports", "Compare Grades 11–12 and export recorded learning evidence."],
    ],
  },
];

const learningSteps = [
  {icon: Smartphone, title: "Students practice in the app", text: "Lessons, assessments, and simulations cover Phishing, Smishing, Vishing, Pretexting, and Baiting."},
  {icon: ClipboardCheck, title: "Teachers act on the results", text: "Check recorded mastery, review a student’s learning needs, and document classroom support."},
  {icon: FileDown, title: "Bring evidence to the discussion", text: "Review recorded pre-test and post-test scores, then export PDF or CSV reports for meetings."},
];

const threats = [
  {name:"Phishing", icon:Mail, hint:"Deceptive emails", text:"Recognize emails that impersonate trusted senders and ask for sensitive information.", color:"#285bd4"},
  {name:"Smishing", icon:MessageSquare, hint:"Misleading texts", text:"Spot suspicious text messages, urgent requests, and links that lead away from trusted services.", color:"#5361bf"},
  {name:"Vishing", icon:Phone, hint:"Fraudulent calls", text:"Question callers who use authority or urgency to pressure you into sharing private information.", color:"#347a86"},
  {name:"Pretexting", icon:UserRound, hint:"Invented identities", text:"Look beyond a convincing story. Verify who is asking and why they need your information.", color:"#91601e"},
  {name:"Baiting", icon:Gift, hint:"Offers with a catch", text:"Pause before accepting a tempting download, reward, or device from an unfamiliar source.", color:"#7254a3"},
];
const roleTaskIcons = [[ChartNoAxesColumnIncreasing, ClipboardCheck, FileDown], [GraduationCap, Users, BookOpen], [Users, ShieldCheck, FileDown]];

function returnToTop() {
  document.getElementById("hero-title")?.focus({preventScroll:true});
  window.scrollTo({
    top:0,
    behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
}

export default function LandingPage() {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [roleIndex, setRoleIndex] = useState(0);
  const [threatIndex, setThreatIndex] = useState(0);
  const pageRef = useRef(null);
  const selectedRole = roles[roleIndex];
  const RoleIcon = selectedRole.icon;
  const selectedThreat = threats[threatIndex];
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!("IntersectionObserver" in window)) return;
    const animations = new Set();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (motion.matches || !entry.target.animate) continue;
        const animation = entry.target.animate(
          [{opacity:0.55, transform:"translateY(18px)"}, {opacity:1, transform:"translateY(0)"}],
          {duration:480, easing:"cubic-bezier(.2,.7,.3,1)"},
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, {threshold:0.08});
    pageRef.current.querySelectorAll("[data-reveal]").forEach(element => observer.observe(element));
    const stopMotion = () => { if (motion.matches) animations.forEach(animation => animation.cancel()); };
    motion.addEventListener("change",stopMotion);
    return () => {
      observer.disconnect();
      animations.forEach(animation => animation.cancel());
      motion.removeEventListener("change",stopMotion);
    };
  }, []);
  const sample = sampleSections[sectionIndex];
  const {skills} = summarizeStudents(sample.students, []);
  const focus = skills.filter(skill => skill.value !== null).reduce((lowest, skill) => skill.value < lowest.value ? skill : lowest);
  const assessed = sample.students.filter(student => Number.isFinite(student.mastery[focus.name]));
  const needPractice = assessed.filter(student => student.mastery[focus.name] < 0.4).length;
  return (
    <div ref={pageRef} className="lb-landing" id="top">
      <FontImports/>
      <a className="lb-skip" href="#main">Skip to content</a>
      <header className="lb-header"><div className="lb-container lb-header-inner">
        <a href="#top" className="lb-wordmark" aria-label="LEVELBLUE home"><Shield aria-hidden="true"/><span>LEVEL<span>BLUE</span></span></a>
        <nav aria-label="Main navigation">
          <a href="#features">Class diagnostics</a>
          <a href="#for-educators">Staff tools</a>
          <a className="lb-login-link" href="/login">Log in <ArrowRight aria-hidden="true"/></a>
        </nav>
      </div></header>
      <main id="main">
        <section className="lb-hero-band" aria-labelledby="hero-title"><div className="lb-hero lb-container">
          <div className="lb-hero-copy">
            <p className="lb-hero-context"><BookOpen size={18} aria-hidden="true"/>Built for Grade 11 & 12 educators</p>
            <h1 id="hero-title" tabIndex={-1}>See who needs support.<br/><span>Know what to teach next.</span></h1>
            <p>Your students play, practice, and learn. LEVELBLUE helps you see their progress, spot gaps in social engineering awareness, and plan the support that matters.</p>
            <div className="lb-hero-links">
              <a className="lb-button" href="/login">Log in to LEVELBLUE <ArrowRight aria-hidden="true"/></a>
              <a className="lb-explore" href="#features">Try the live preview <ArrowDown size={16} aria-hidden="true"/></a>
            </div>
          </div>
          <div className="lb-preview" data-reveal>
          <div className="lb-preview-heading"><span><ChartNoAxesColumnIncreasing size={17} aria-hidden="true"/>Your classroom, at a glance</span></div>
          <figure className="lb-chart">
            <figcaption>
              <h2><ChartNoAxesColumnIncreasing aria-hidden="true"/>Class mastery by topic</h2>
              <ChoicePicker className="lb-sample-filter" label="Sample section" value={sectionIndex} onChange={setSectionIndex} options={sampleSections.map((section,index)=>({value:index,label:section.label,description:section.students.length+" sample learners",icon:GraduationCap}))}/>
            </figcaption>
            <div className="lb-plot">
              <div className="lb-scale" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
              <dl className="lb-columns">{skills.map(({name,value}, index) =>
                <div key={name} className={name===focus.name?'is-focus':''}>
                  <dt>{name}</dt>
                  <dd><span style={{height:(value ?? 0)+'%', '--bar-order':index}}><b>{value===null?'—':value+'%'}</b></span></dd>
                </div>
              )}</dl>
            </div>
            <div className="lb-chart-note" aria-live="polite"><Focus aria-hidden="true"/><p><span>Where to focus next</span><strong>{focus.name}</strong> has the lowest average mastery.</p><a href="#features" aria-label="Explore learners needing support"><ArrowDown aria-hidden="true"/></a></div>
          </figure>
          <p className="lb-preview-caption">Try switching sections. These fictional records show how your workspace works.</p>
          </div>
        </div></section>
        <section className="lb-topic-band" aria-labelledby="threats-title"><div className="lb-container">
          <div className="lb-threat-heading"><h2 id="threats-title">Five threats.<br/><span>Confidence starts with recognition.</span></h2></div>
          <div className="lb-threat-choices" role="group" aria-label="Explore social engineering threats">{threats.map(({name,icon:Icon,hint,color},index)=>
            <button key={name} type="button" style={{'--threat-color':color}} aria-pressed={threatIndex===index} aria-controls="threat-description" onClick={()=>setThreatIndex(index)}><span className="lb-threat-icon"><Icon aria-hidden="true"/></span><strong>{name}</strong><span>{hint}</span></button>
          )}</div>
          <div id="threat-description" className="lb-threat-description" aria-live="polite"><p key={selectedThreat.name}><strong>{selectedThreat.name}</strong>{selectedThreat.text}</p></div>
        </div></section>
        <section id="features" className="lb-evidence" aria-labelledby="evidence-title"><div className="lb-container lb-evidence-inner">
          <div className="lb-evidence-copy" data-reveal>
            <h2 id="evidence-title">Find the learner behind the numbers.</h2>
            <p>Know where a little extra guidance could make a difference. Explore the heatmap by topic to see individual strengths and areas for practice.</p>
            <div className="lb-focus-summary">
              <Focus aria-hidden="true"/>
              <div><span>{sample.label} · Sample records</span><strong>{needPractice} of {assessed.length} assessed learners</strong><p>Below 40% mastery in {focus.name.toLowerCase()}.</p></div>
            </div>
            <p className="lb-evidence-hint">A dash means mastery has not been recorded for that topic.</p>
          </div>
          <div className="lb-heatmap-frame" data-reveal><StudentMastery students={sample.students} sectionName={sample.section}/></div>
        </div></section>
        <section className="lb-workflow lb-container" aria-labelledby="workflow-title">
          <div className="lb-workflow-lead" data-reveal><h2 id="workflow-title">A path from practice <span>to progress.</span></h2><p>Learning starts in the game. Meaningful support starts with what you see next.</p><div className="lb-workflow-first"><span>01 / PRACTICE</span><h3>{learningSteps[0].title}</h3><p>{learningSteps[0].text}</p></div></div>
          <ol className="lb-learning-steps" start={2}>{learningSteps.slice(1).map(({icon:Icon,title,text},index) =>
            <li key={title} data-reveal><Icon aria-hidden="true"/><div><span className="lb-step-number">0{index+2} / {index===0?'SUPPORT':'REFLECT'}</span><h3>{title}</h3><p>{text}</p></div></li>
          )}</ol>
        </section>
        <section id="for-educators" className="lb-roles lb-container" aria-labelledby="roles-title">
          <div className="lb-section-heading" data-reveal><h2 id="roles-title">Made for the way your school works.</h2></div>
          <div className="lb-role-workspace" data-reveal>
            <div className="lb-role-choices" role="group" aria-label="Explore staff roles">
              {roles.map(({icon:Icon,title},index) => <button key={title} type="button" aria-pressed={roleIndex===index} aria-controls="role-details" onClick={()=>setRoleIndex(index)}><Icon aria-hidden="true"/><span>{title}</span></button>)}
            </div>
            <div id="role-details" className="lb-role-details">
              <div className="lb-role-intro" key={selectedRole.title}><span className="lb-role-emblem"><RoleIcon aria-hidden="true"/></span><h3>{selectedRole.heading}</h3><p>{selectedRole.text}</p><a href="/login">Go to your workspace <ArrowRight size={17} aria-hidden="true"/></a></div>
              <ul key={roleIndex}>{selectedRole.tasks.map(([title,text],index)=>{const Icon=roleTaskIcons[roleIndex][index];return <li key={title}><span className="lb-role-task-icon"><Icon aria-hidden="true"/></span><div><h4>{title}</h4><p>{text}</p></div></li>;})}</ul>
            </div>
          </div>
        </section>
        <section className="lb-questions lb-container" aria-labelledby="questions-title">
          <div data-reveal><h2 id="questions-title">A little clarity before you begin.</h2><p>A few things to know before opening your workspace.</p></div>
          <div className="lb-question-list" data-reveal>
            <details><summary>What does a mastery percentage mean?<ChevronDown aria-hidden="true"/></summary><p>LEVELBLUE uses Bayesian Knowledge Tracing (BKT) to estimate a learner’s understanding from recorded answers. Teachers can use the estimate alongside assessment scores and classroom observations.</p></details>
            <details><summary>How are learning gains reported?<ChevronDown aria-hidden="true"/></summary><p>Reports calculate a gain when a learner has a confirmed pre-test and post-test on a comparable scale. Incomplete or missing assessments are identified in the records.</p></details>
            <details><summary>Can I review student feedback?<ChevronDown aria-hidden="true"/></summary><p>Student Feedback shows ratings and comments submitted through the mobile app. Filter by section or module to see where students report difficulty or usability problems.</p></details>
            <details><summary>How do I get an account?<ChevronDown aria-hidden="true"/></summary><p>Use the staff account provided by your school. When activating an invited account, sign in with your temporary password, verify the emailed code, and choose a new password.</p></details>
          </div>
        </section>
        <section className="lb-start lb-container" data-reveal aria-labelledby="start-title">
          <div><h2 id="start-title">Bring your next lesson into focus.</h2><p>Open your workspace to review your school’s recorded learning results.</p></div>
          <a className="lb-button" href="/login">Open your workspace<ArrowRight aria-hidden="true"/></a>
        </section>
      </main>
      <footer className="lb-container lb-footer"><div><span>LEVELBLUE</span><p>Better insight. More purposeful teaching.</p></div><button type="button" className="lb-back-top" aria-label="Back to top" title="Back to top" onClick={returnToTop}><ArrowUp aria-hidden="true"/></button></footer>
    </div>
  );
}
