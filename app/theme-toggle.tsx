'use client';
import {useEffect, useState} from 'react';
import {Monitor, Moon, Sun} from 'lucide-react';

type Pref='auto'|'light'|'dark';
const order:Pref[]=['auto','light','dark'];
const labels:Record<Pref,string>={auto:'Theme: automatic',light:'Theme: light',dark:'Theme: dark'};

function stored():Pref{try{const v=window.localStorage.getItem('ugs-theme');return v==='light'||v==='dark'?v:'auto';}catch{return 'auto';}}
function apply(pref:Pref){
  const dark=pref==='dark'||(pref==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
}

/** Light / dark / automatic switch. The choice is remembered on this device. */
export default function ThemeToggle(){
  const [pref,setPref]=useState<Pref>('auto');
  useEffect(()=>{
    const p=stored();setPref(p);apply(p);
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const change=()=>{if(stored()==='auto')apply('auto');};
    media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[]);
  function next(){
    const p=order[(order.indexOf(pref)+1)%order.length];
    setPref(p);try{window.localStorage.setItem('ugs-theme',p);}catch{/* private window: the choice just won't persist */}
    apply(p);
  }
  const Icon=pref==='dark'?Moon:pref==='light'?Sun:Monitor;
  return <button type="button" className="icon-btn theme-toggle" onClick={next} aria-label={`${labels[pref]}. Change theme`} title={labels[pref]}><Icon size={16}/></button>;
}
