import React from 'react';
import { Check } from 'lucide-react';
import { tap } from '../lib/native';
import { sfxSwitch } from '../lib/sound';

/** Two little phone mock-ups to choose the app's look. Data is shared; only the look changes. */
export default function StylePicker({ value, onChange }) {
  const pick = (v) => { if (v === value) return; tap('medium'); sfxSwitch(v === 'zen'); onChange(v); };
  return (
    <div className="sp">
      <button className={`sp-opt ${value !== 'zen' ? 'on' : ''}`} onClick={() => pick('classic')}>
        <span className="sp-ph classic">
          <i className="hd" /><i className="ring" /><i className="ln w1" /><i className="ln w2" /><i className="ln w3" />
          <i className="nv" />
        </span>
        <span className="sp-l"><b>Classic</b><small>Bold, dark, lime</small></span>
        {value !== 'zen' && <span className="sp-ok"><Check size={13} strokeWidth={3} /></span>}
      </button>
      <button className={`sp-opt ${value === 'zen' ? 'on' : ''}`} onClick={() => pick('zen')}>
        <span className="sp-ph zen">
          <span className="aa">Aa</span><i className="card" /><i className="dots"><b /><b /><b /><b /></i><i className="ln w2" />
          <i className="nv" />
        </span>
        <span className="sp-l"><b>Zen</b><small>Calm, soft, focused</small></span>
        {value === 'zen' && <span className="sp-ok"><Check size={13} strokeWidth={3} /></span>}
      </button>
    </div>
  );
}
