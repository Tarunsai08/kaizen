import React from 'react';
import { Check } from 'lucide-react';
import { tap } from '../lib/native';
import { sfxSwitch } from '../lib/sound';

/** Two little phone mock-ups to choose the app's look. Data is shared; only the look changes. */
export default function StylePicker({ value, onChange }) {
  const isS = value === 'studio' || value === 'zen';
  const pick = (v) => { if ((v === 'studio') === isS) return; tap('medium'); sfxSwitch(v === 'studio'); onChange(v); };
  return (
    <div className="sp">
      <button className={`sp-opt ${!isS ? 'on' : ''}`} onClick={() => pick('classic')}>
        <span className="sp-ph classic">
          <i className="hd" /><i className="ring" /><i className="ln w1" /><i className="ln w2" /><i className="ln w3" />
          <i className="nv" />
        </span>
        <span className="sp-l"><b>Classic</b><small>Bold, dark, lime</small></span>
        {!isS && <span className="sp-ok"><Check size={13} strokeWidth={3} /></span>}
      </button>
      <button className={`sp-opt ${isS ? 'on' : ''}`} onClick={() => pick('studio')}>
        <span className="sp-ph studio">
          <span className="aa">Aa</span><i className="card" /><i className="dots"><b /><b /><b /><b /></i><i className="ln w2" />
          <i className="nv" />
        </span>
        <span className="sp-l"><b>Studio</b><small>New layout, calm & focused</small></span>
        {isS && <span className="sp-ok"><Check size={13} strokeWidth={3} /></span>}
      </button>
    </div>
  );
}
