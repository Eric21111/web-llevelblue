import {useEffect, useId, useRef, useState} from "react";
import {Check, ChevronDown} from "lucide-react";
import "../styles/choice-picker.css";

// A shared, keyboard-accessible picker for the section and mastery previews.
export default function ChoicePicker({label, value, options, onChange, className = ""}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const items = useRef([]);
  const pendingFocus = useRef(0);
  const selected = options.findIndex(option => option.value === value);
  useEffect(() => {
    if (!open) return;
    items.current[pendingFocus.current]?.focus();
    const dismiss = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  function select(option) {
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  function openMenu() { pendingFocus.current = Math.max(0, selected); setOpen(true); }
  function navigate(event) {
    const index = items.current.indexOf(document.activeElement);
    const last = options.length - 1;
    let next = event.key === "ArrowDown" ? (index + 1) % options.length
      : event.key === "ArrowUp" ? (index + last) % options.length
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const match = options.findIndex((_, offset) => options[(index + offset + 1) % options.length].label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match >= 0) next = (index + match + 1) % options.length;
    }
    if (next !== null) { event.preventDefault(); items.current[next]?.focus(); }
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    if (event.key === "Tab") setOpen(false);
  }
  return <div className={"choice-picker " + className} ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span id={id+"-label"} className="choice-label">{label}</span>
    <button ref={trigger} type="button" className="choice-trigger" aria-labelledby={id+"-label "+id+"-value"} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id+"-options" : undefined}
      onClick={() => open ? setOpen(false) : openMenu()}
      onKeyDown={event => { if (["ArrowDown","ArrowUp"].includes(event.key)) { event.preventDefault(); openMenu(); } }}>
      <span id={id+"-value"}>{options[selected]?.label ?? "Choose an option"}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && <div className="choice-options" role="listbox" id={id+"-options"} aria-labelledby={id+"-label"} onKeyDown={navigate}>
      {options.map((option,index) => { const Icon = option.icon; return <button type="button" role="option" aria-selected={value===option.value} tabIndex={-1} key={option.value} ref={element => { items.current[index]=element; }} onClick={() => select(option)}>
        {Icon && <Icon size={19} aria-hidden="true"/>}<span>{option.label}{option.description && <small>{option.description}</small>}</span>{value===option.value && <Check size={16} aria-hidden="true"/>}
      </button>;})}
    </div>}
  </div>;
}
