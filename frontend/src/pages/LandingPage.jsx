import { useState } from "react";
import {
  ArrowDown, ArrowRight, Activity, BarChart3, BookOpen, Check,
  ChevronRight, Database, GraduationCap, LayoutDashboard, LockKeyhole,
  Mail, Menu, MessageSquare, MousePointer2, Phone, Shield, ShieldCheck,
  Target, TrendingUp, Users, X,
} from "lucide-react";
import FontImports from "../components/FontImports";
import "./LandingPage.css";

const skills = [
  { name: "Phishing", icon: Mail, value: 86 },
  { name: "Smishing", icon: MessageSquare, value: 74 },
  { name: "Vishing", icon: Phone, value: 68 },
  { name: "Pretexting", icon: Users, value: 81 },
  { name: "Baiting", icon: MousePointer2, value: 76 },
];

const features = [
  { icon: Target, title: "See learning take shape", text: "Follow mastery across five social engineering threats. See where understanding is growing and where students need support.", tag: "Skill analytics" },
  { icon: Users, title: "Keep your classes connected", text: "Organize sections, manage your class roster, and bring each student’s learning progress into one clear view.", tag: "Class management" },
  { icon: Activity, title: "Look beyond the scores", text: "Review engagement, compare pre- and post-test results, and spot students who may benefit from a follow-up.", tag: "Engagement & progress" },
];

const audiences = {
  teachers: {
    eyebrow: "MORE CLARITY. MORE TIME TO TEACH.",
    title: "Know who needs a little more guidance.",
    text: "Turn student activity into a clearer picture of your classroom. LEVELBLUE helps you focus your next lesson on the skills that need it most.",
    items: ["Monitor mastery for each student and section", "Identify learning gaps and at-risk students", "Review engagement and pre/post-test gains"],
    label: "YOUR CLASSROOM, AT A GLANCE",
    cards: [
      { icon: GraduationCap, title: "Class roster & sections", text: "Your students, organized in one place." },
      { icon: BarChart3, title: "Individual skill insights", text: "A clearer view of strengths and learning gaps." },
      { icon: Target, title: "Focused follow-ups", text: "See which students need your attention." },
    ],
  },
  heads: {
    eyebrow: "A CLEARER VIEW ACROSS YOUR SCHOOL.",
    title: "Support your teachers. See the bigger picture.",
    text: "Bring account management, learning content, and school-wide outcomes together. Give your teachers the support they need to keep awareness training moving.",
    items: ["Manage teacher accounts and access", "Maintain the training content bank", "Compare section outcomes and review system logs"],
    label: "YOUR SCHOOL, WORKING TOGETHER",
    cards: [
      { icon: Users, title: "Teacher accounts", text: "Manage the people guiding your learners." },
      { icon: Database, title: "A shared content bank", text: "Keep training questions organized." },
      { icon: BarChart3, title: "School-wide insights", text: "Compare learning gains across sections." },
    ],
  },
};

function Brand() {
  return <span className="lb-brand"><span className="lb-brand-mark"><Shield size={22} strokeWidth={2} /></span><span>LEVEL<span className="lb-teal">BLUE</span><small>LEARN. RECOGNIZE. PROTECT.</small></span></span>;
}

function DashboardPreview() {
  return (
    <figure className="lb-preview" aria-label="Illustrative dashboard showing sample class mastery and learning progress">
      <div className="lb-preview-top"><span className="lb-window-dots"><i /><i /><i /></span><span><LockKeyhole size={10} /> LEVELBLUE / Teacher console</span><span className="lb-sample">DEMO</span></div>
      <div className="lb-preview-body">
        <div className="lb-preview-rail" aria-hidden="true"><Shield size={21} /><LayoutDashboard className="active" size={18} /><Users size={18} /><BarChart3 size={18} /><BookOpen size={18} /><Activity size={18} /></div>
        <div className="lb-preview-content">
          <div className="lb-preview-heading"><div><span className="lb-mini-label">THE BIG PICTURE</span><h3>Learning, made visible.</h3></div><span className="lb-avatar">T</span></div>
          <div className="lb-preview-stats"><div><span>Class mastery</span><strong>77<span>%</span></strong><small><TrendingUp size={12} /> Growing together</small></div><div><span>Learning gain</span><strong>+24<span> pts</span></strong><small>From pre- to post-test</small></div><div><span>Threat types</span><strong>05</strong><small>One clearer picture</small></div></div>
          <div className="lb-chart-card">
            <div className="lb-chart-heading"><span>Mastery over time</span><span className="lb-chart-key">Class average</span></div>
            <svg className="lb-growth-chart" viewBox="0 0 430 158" role="img" aria-label="Sample mastery increases from 32 to 77 percent across six weeks">
              <defs><linearGradient id="lb-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3dd6c4" stopOpacity=".24" /><stop offset="100%" stopColor="#3dd6c4" stopOpacity="0" /></linearGradient></defs>
              {[25, 65, 105].map((y, i) => <g key={y}><text x="0" y={y + 4}>{[100, 70, 40][i]}%</text><line x1="35" x2="425" y1={y} y2={y} /></g>)}
              <path d="M35 117 C70 117 85 97 112 98 S167 73 190 77 S245 53 270 57 S325 40 348 43 S398 25 425 27 L425 137 L35 137Z" fill="url(#lb-chart-fill)" />
              <path className="lb-chart-line" d="M35 117 C70 117 85 97 112 98 S167 73 190 77 S245 53 270 57 S325 40 348 43 S398 25 425 27" fill="none" stroke="#3dd6c4" strokeWidth="2.5" pathLength="1" />
              <circle cx="425" cy="27" r="4" fill="#3dd6c4" stroke="#122539" strokeWidth="3" />
              {[35, 112, 190, 270, 348, 410].map((x, i) => <text key={x} x={x} y="155" textAnchor="middle">W{i + 1}</text>)}
            </svg>
          </div>
          <div className="lb-skill-heading"><span>Skills in focus</span><span>Mastery</span></div>
          <div className="lb-skill-bars">{skills.slice(0, 3).map(({ name, value }) => <div key={name}><span>{name}</span><div><i style={{ "--progress": `${value}%` }} /></div><strong>{value}%</strong></div>)}</div>
        </div>
      </div>
      <figcaption>Illustrative preview · Sample data</figcaption>
      <div className="lb-preview-note"><span><ShieldCheck size={23} /></span><div><strong>Small insights. Safer habits.</strong><small>Help awareness become understanding.</small></div></div>
    </figure>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [audience, setAudience] = useState("teachers");
  const selected = audiences[audience];

  return (
    <div className="lb-landing" id="top">
      <FontImports />
      <a className="lb-skip" href="#main">Skip to content</a>
      <header className="lb-header"><div className="lb-container lb-header-inner">
        <a href="/" className="lb-brand-link" aria-label="LEVELBLUE home"><Brand /></a>
        <nav className={`lb-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#for-educators" onClick={() => setMenuOpen(false)}>For educators</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        </nav>
        <div className="lb-header-actions"><a className="lb-button lb-button-small" href="/login">Log in <ArrowRight size={15} /></a><button className="lb-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
      </div></header>

      <main id="main">
        <section className="lb-hero lb-container" aria-labelledby="hero-title">
          <div className="lb-hero-copy"><div className="lb-eyebrow"><span className="lb-status-dot" /> CYBER AWARENESS STARTS HERE</div>
            <h1 id="hero-title">A safer digital world.<br /><span>One learner<br className="lb-desktop-break" /> at a time.</span></h1>
            <p>See how your students learn to spot a threat.<br className="lb-desktop-break" /> Turn cybersecurity learning into meaningful insights for your classroom and your school.</p>
            <div className="lb-hero-actions"><a className="lb-button" href="/login">Log in to LEVELBLUE <ArrowRight size={17} /></a><a className="lb-text-link" href="#features">Explore the features <ArrowDown size={15} /></a></div>
            <div className="lb-hero-footnote"><GraduationCap size={16} /><span>Built for teachers. Designed for school heads.</span></div>
          </div>
          <div className="lb-hero-visual"><div className="lb-orbit lb-orbit-one" aria-hidden="true" /><div className="lb-orbit lb-orbit-two" aria-hidden="true" /><DashboardPreview /></div>
        </section>

        <section className="lb-threat-strip" aria-label="Social engineering skills covered"><div className="lb-container lb-threat-inner"><span>REAL-WORLD THREATS.<br /><strong>Real learning.</strong></span><div>{skills.map(({ name, icon: Icon }) => <span key={name}><Icon size={18} />{name}</span>)}</div></div></section>

        <section className="lb-section lb-container" id="features" aria-labelledby="features-title">
          <div className="lb-section-intro"><div><span className="lb-eyebrow">FROM AWARENESS TO ACTION</span><h2 id="features-title">Less guesswork.<br />More meaningful progress.</h2></div><p>Everything you need to understand learning,<br className="lb-desktop-break" /> support your students, and move forward.</p></div>
          <div className="lb-feature-grid">{features.map(({ icon: Icon, title, text, tag }, index) => <article className="lb-feature-card" key={title}><div className="lb-feature-top"><span className="lb-icon-box"><Icon size={23} /></span><span className="lb-feature-number">0{index + 1}</span></div><h3>{title}</h3><p>{text}</p><span className="lb-feature-tag">{tag}<ArrowRight size={14} /></span></article>)}</div>
        </section>

        <section className="lb-audience-section" id="for-educators" aria-labelledby="audience-title"><div className="lb-container">
          <div className="lb-audience-header"><span className="lb-eyebrow">DIFFERENT ROLES. ONE SHARED PURPOSE.</span><h2 id="audience-title">Built around the work you do.</h2><div className="lb-role-switch" role="group" aria-label="Choose your role"><button type="button" aria-pressed={audience === "teachers"} onClick={() => setAudience("teachers")}><GraduationCap size={17} />For teachers</button><button type="button" aria-pressed={audience === "heads"} onClick={() => setAudience("heads")}><ShieldCheck size={17} />For school heads</button></div></div>
          <div className="lb-audience-content"><div className="lb-audience-copy"><span className="lb-mini-label">{selected.eyebrow}</span><h3>{selected.title}</h3><p>{selected.text}</p><ul>{selected.items.map(item => <li key={item}><Check size={16} />{item}</li>)}</ul><a className="lb-text-link lb-teal" href="/login">Go to your console <ArrowRight size={16} /></a></div><div className="lb-role-preview"><span className="lb-mini-label">{selected.label}</span>{selected.cards.map(({ icon: Icon, title, text }, index) => <div className="lb-role-card" key={title}><span className={`lb-icon-box lb-role-icon-${index}`}><Icon size={22} /></span><div><h4>{title}</h4><p>{text}</p></div><ChevronRight size={16} /></div>)}<div className="lb-role-note"><LockKeyhole size={13} />Your account opens the tools for your role.</div></div></div>
        </div></section>

        <section className="lb-section lb-container" id="how-it-works" aria-labelledby="how-title"><div className="lb-centered-intro"><span className="lb-eyebrow">A SIMPLE PATH FORWARD</span><h2 id="how-title">From sign-in to insight.</h2><p>Stay connected to learning in three simple steps.</p></div><div className="lb-steps">{[
          ["01", "Make yourself at home", "Log in with your assigned account. Your role brings you straight to the right console."],
          ["02", "See the learning unfold", "Explore student mastery and engagement, or review progress across your school."],
          ["03", "Make your next move count", "Use what you discover to guide follow-ups, support teachers, and strengthen awareness."],
        ].map(([number, title, text]) => <article key={number}><span className="lb-step-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

        <section className="lb-container lb-cta-wrap"><div className="lb-cta"><div className="lb-cta-emblem" aria-hidden="true"><ShieldCheck size={42} /></div><span className="lb-eyebrow">BETTER INSIGHTS. STRONGER AWARENESS.</span><h2>Help your learners stay one step ahead.</h2><p>Your next teaching insight is waiting in LEVELBLUE.</p><a className="lb-button" href="/login">Log in to your console <ArrowRight size={17} /></a><small>For teachers and school heads with an existing account.</small></div></section>
      </main>
      <footer className="lb-container lb-footer"><a href="#top" className="lb-brand-link" aria-label="LEVELBLUE, back to top"><Brand /></a><p>Building awareness. Empowering educators.</p><a href="/login">Log in <ArrowUpRightIcon /></a></footer>
    </div>
  );
}

function ArrowUpRightIcon() { return <ArrowRight size={14} style={{ transform: "rotate(-45deg)" }} />; }
