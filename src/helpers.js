import NOTES from "./notes";
import MNOTES from "./mnotes";

export const getNotesForOctave = octave =>
  Object.keys(NOTES).reduce((state, note) => {
    if (note.split("").pop() === String(octave)) state[note] = NOTES[note];
    return state;
  }, {});

export const dummyNotes = [
  { pitch: 72, quantizedStartStep: 0, quantizedEndStep: 2 },
  { pitch: 76, quantizedStartStep: 2, quantizedEndStep: 3 },
  { pitch: 79, quantizedStartStep: 3, quantizedEndStep: 4 }
];
export const defaultPads = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

export const defaultState = {
  type: "sine",
  pads: defaultPads,
  bpm: 150,
  release: 100,
  step: 0,
  steps: 8,
  playing: false,
  octave: 4,
  delay: false,
  notes: getNotesForOctave(4),
  outOfOctave: [],
  isInitialized: false,
  heat: 1.1
};

export function swapKeyVal(obj) {
  let swapped = {};
  for (let key in obj) {
    swapped[obj[key]] = key;
  }
  return swapped;
}

export let swappedNOTES = swapKeyVal(NOTES);

export let result = [];
export let seedNotes = [];
export function recorder(note) {
  if (result.length < 8) {
    result.push(note[0]);
  }
  if (result.length === 8) {
    let count = 0;
    const inPitch = result
      .map(freq => swappedNOTES[freq])
      .map(midi => MNOTES[midi]);
    let notes = inPitch.map(pitch => {
      if (pitch) {
        return {
          pitch: pitch,
          quantizedStartStep: count,
          quantizedEndStep: ++count
        };
      } else {
        return {
          pitch: -1,
          quantizedStartStep: count,
          quantizedEndStep: ++count
        };
      }
    });
    //get rid of rests represented by -1.
    seedNotes = notes.filter(note => note.pitch !== -1);
    result = [];
  }
}
