import React, { useState } from 'react';
import {
  Droplet, BookOpen, Dumbbell, Footprints, Brain, Moon, Sun, Apple, Salad, Coffee, Pill, Bike, Music, Mic, Guitar,
  PenLine, Code, Laptop, Languages, Heart, Smile, Phone, Users, Leaf, Flower2, Sparkles, Target, Timer, Bed,
  Wallet, PiggyBank, ShowerHead, Wind, Mountain, Waves, Camera, Palette, Gamepad2, Tv, Smartphone, Cigarette,
  Wine, Candy, Ban, Flame, Zap, Star, CheckCircle2, GraduationCap, Brush, Home, Dog, HandHeart, Sunrise, Sprout,
} from 'lucide-react';
import { tap } from '../lib/native';

export const ICONS = {
  Droplet, BookOpen, Dumbbell, Footprints, Brain, Moon, Sun, Sunrise, Apple, Salad, Coffee, Pill, Bike, Music, Mic, Guitar,
  PenLine, Code, Laptop, Languages, GraduationCap, Heart, Smile, Phone, Users, HandHeart, Leaf, Flower2, Sprout, Sparkles,
  Target, Timer, Bed, Wallet, PiggyBank, ShowerHead, Wind, Mountain, Waves, Camera, Palette, Brush, Home, Dog,
  Gamepad2, Tv, Smartphone, Cigarette, Wine, Candy, Ban, Flame, Zap, Star, CheckCircle2,
};

/* Renders a habit icon: 'i:Name' → line icon, anything else → emoji text */
export function HIcon({ icon, size = 20, color = 'currentColor' }) {
  if (icon && icon.startsWith('i:')) {
    const C = ICONS[icon.slice(2)] || Sparkles;
    return <C size={size} color={color} strokeWidth={2.1} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{icon || '•'}</span>;
}

export function IconTile({ icon, color = 'var(--accent)', size = 40 }) {
  return (
    <div className="tile" style={{ width: size, height: size, borderRadius: size * 0.33, background: `color-mix(in srgb, ${color} 17%, transparent)` }}>
      <HIcon icon={icon} size={Math.round(size * 0.48)} color={color} />
    </div>
  );
}

export function IconPicker({ value, onChange, color = 'var(--accent)' }) {
  const [mode, setMode] = useState(value && !value.startsWith('i:') ? 'emoji' : 'icons');
  const [custom, setCustom] = useState('');
  return (
    <div className="col gap-10">
      <div className="row gap-6">
        {['icons', 'emoji'].map((m) => (
          <button key={m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{m === 'icons' ? 'Icons' : 'Emoji'}</button>
        ))}
      </div>
      {mode === 'icons' ? (
        <div className="emoji-pick">
          {Object.keys(ICONS).map((k) => (
            <button key={k} className={value === 'i:' + k ? 'on' : ''} onClick={() => { tap(); onChange('i:' + k); }} style={{ display: 'grid', placeItems: 'center' }}>
              <HIcon icon={'i:' + k} size={19} color={value === 'i:' + k ? color : 'var(--text-2)'} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="emoji-pick">
            {['💧', '🧘', '📖', '🏃', '💪', '🥗', '😴', '🎸', '🎤', '✍️', '🧠', '💻', '🌅', '🚶', '🍎', '💊', '📵', '🚭', '🍺', '🍫', '🎮', '📱', '☕', '🙏'].map((e) => (
              <button key={e} className={value === e ? 'on' : ''} onClick={() => onChange(e)}>{e}</button>
            ))}
          </div>
          <input className="input" placeholder="Or type any emoji" value={custom} maxLength={4} onChange={(e) => { setCustom(e.target.value); if (e.target.value.trim()) onChange(e.target.value.trim()); }} />
        </>
      )}
    </div>
  );
}
