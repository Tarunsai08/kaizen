import TodaySky from './Sky';
import TodayQuest from './Quest';
import TodayOrbit from './Orbit';
import TodayNotebook from './Notebook';
import TodayJourney from './Journey';
import TodayCockpit from './Cockpit';
import TodayArcade from './Arcade';

export const LAYOUTS = { sky: TodaySky, quest: TodayQuest, orbit: TodayOrbit, notebook: TodayNotebook, journey: TodayJourney, cockpit: TodayCockpit, arcade: TodayArcade };
export const TODAY_LAYOUTS = [
  { value: 'classic', label: 'Classic' },
  { value: 'sky', label: 'Sky' },
  { value: 'quest', label: 'Quest log' },
  { value: 'orbit', label: 'Orbit' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'journey', label: 'Journey map' },
  { value: 'cockpit', label: 'Cockpit' },
  { value: 'arcade', label: 'Arcade' },
];
