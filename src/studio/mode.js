// "Studio" is the redesigned app; "Classic" is the original. Older builds called Studio "zen".
export const isStudio = (s) => s?.uiStyle === 'studio' || s?.uiStyle === 'zen';
// Study as a BYJU'S-style learning journey: on by default in Studio, off in Classic, and either can be chosen in Settings.
export const journeyOn = (s) => (s?.studyStyle === 'journey' ? true : s?.studyStyle === 'roadmap' ? false : isStudio(s));
