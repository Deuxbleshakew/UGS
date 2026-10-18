'use client';
import {useState, type InputHTMLAttributes} from 'react';
import {Eye, EyeOff} from 'lucide-react';

/** Password field with a show/hide button. Phones make typing a hidden password error-prone. */
export default function PasswordInput(props:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){
  const [shown,setShown]=useState(false);
  return <span className="password-wrap">
    <input {...props} type={shown?'text':'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false}/>
    <button type="button" className="password-eye" onClick={()=>setShown(s=>!s)} aria-label={shown?'Hide password':'Show password'} aria-pressed={shown}>{shown?<EyeOff size={18}/>:<Eye size={18}/>}</button>
  </span>;
}
