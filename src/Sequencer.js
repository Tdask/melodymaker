/* eslint-disable react/no-unused-state, react/no-array-index-key */
import React, { Component } from "react";
import cx from "classnames";
import Synth from "./Synth";
import NOTES from "./notes";
import MNOTES from "./mnotes";
import * as mm from "@magenta/music";

const melodyrnn = new mm.MusicRNN(
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn"
);

const magentaPlayer = new mm.Player();
let seedNotes = [];

const getNotesForOctave = octave =>
  Object.keys(NOTES).reduce((state, note) => {
    if (note.split("").pop() === String(octave)) state[note] = NOTES[note];
    return state;
  }, {});

const dummyNotes = [
  { pitch: 72, quantizedStartStep: 0, quantizedEndStep: 2 },
  { pitch: 76, quantizedStartStep: 2, quantizedEndStep: 3 },
  { pitch: 79, quantizedStartStep: 3, quantizedEndStep: 4 }
];
const defaultPads = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

const defaultState = {
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
  isInitialized: false
};

function swapKeyVal(obj) {
  let swapped = {};
  for (let key in obj) {
    swapped[obj[key]] = key;
  }
  return swapped;
}

let swappedNOTES = swapKeyVal(NOTES);

let result = [];
function recorder(note) {
  // console.log("NOTE: ", note);
  if (result.length < 8) {
    result.push(note[0]);
  }
  if (result.length === 8) {
    let count = 0;
    console.log("RESULT: ", result);
    const inMidi = result.map(freq => swappedNOTES[freq]);
    const inPitch = inMidi.map(midi => MNOTES[midi]);
    // console.log("IN PITCH: ", inPitch);
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

    //get rid of rests represented by -1
    seedNotes = notes.filter(note => note.pitch !== -1);
    // console.log("SEED notes: ", seedNotes);
    result = [];
  }
}

class Sequencer extends Component {
  constructor() {
    super();
    this.state = {
      ...defaultState,
      heat: 1.1
    };
    this.generateSeq = this.generateSeq.bind(this);
    this.newView = this.newView.bind(this);
    this.togglePad = this.togglePad.bind(this);
    this.clearGrid = this.clearGrid.bind(this);
    this.startUp = this.startUp.bind(this);
    this.handleHeat = this.handleHeat.bind(this);
    this.handleStop = this.handleStop.bind(this);
    this.showDefault = this.showDefault.bind(this);
  }

  componentDidMount() {
    this.startUp();
  }

  changeRelease(release) {
    this.setState(
      {
        release
      },
      () => {
        this.pause();
        if (this.state.playing) this.play();
      }
    );
  }

  changeBPM(bpm) {
    if (bpm > 300 || bpm < 60) return;

    this.setState(
      () => ({
        bpm
      }),
      () => {
        this.pause();

        if (this.state.playing) this.play();
      }
    );
  }

  changeWaveType(type) {
    this.setState(
      () => ({
        type
      }),
      () => {
        this.pause();

        if (this.state.playing) this.play();
      }
    );
  }

  changeOctave(octave) {
    this.setState(
      {
        octave: Number(octave),
        notes: getNotesForOctave(Number(octave))
      },
      () => {
        this.pause();

        if (this.state.playing) this.play();
      }
    );
  }

  newView(resultSeq) {
    // clear current view to blank
    console.log("RESULTSEQ: ", resultSeq);
    const { notes } = this.state;
    // console.log("NOTES: ", notes);
    // console.log("default pads right before setting state: ", defaultPads);
    //above console log shows us that defaultPads is essentially what the next view of built melody is going to be, including the repeated old notes. if we can get it so that it is able to only show newest notes than we good.
    //we don't want to only show newest notes, we want to show old notes only when no new note has been added to that group -- otherwise if there is another note added to group we remove that note and only show the newest one.
    // this.setState({
    //   pads: defaultPads.slice()
    // });
    // console.log("state.pads after clearing: ", this.state.pads);
    const pitchLookup = swapKeyVal(MNOTES);
    let midiNoOctave = Object.keys(notes).map(note => note.slice(0, -1));
    const midiIndexObj = swapKeyVal(midiNoOctave);
    // console.log("midi idx obj inside newView: ", midiIndexObj);
    let nextView = this.state.pads.slice();
    // console.log("NEXT VIEW after declaration: ", nextView);
    // console.log("RESULT SEQ: ", resultSeq);

    //make a new sequence that can be triggered in time by the steps
    let seqForGrid = Array(8).fill(null);
    resultSeq.notes.forEach(
      note => (seqForGrid[note.quantizedStartStep] = note.pitch)
    );
    console.log("SequenceForGrid: ", seqForGrid);
    //attempting to iterate through nextView to update the new midi note. if there's a note toggled in the group that is taking a new note we want to untoggle it first before toggling new note. otherwise if the group is empty we can just toggle new note.
    for (let i = 0; i < this.state.pads.length; i++) {
      let group = nextView[i];

      console.log("GROUP: ", group);
      if (seqForGrid[i] !== null) {
        if (group.includes(1)) {
          console.log("group includes 1");
          // group = [(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)];
        }
        const midiToToggle = pitchLookup[seqForGrid[i]].slice(0, -1);
        console.log("MIDI to Toggle: ", midiToToggle);
        let targetIdx = Number(midiIndexObj[midiToToggle]);
        console.log("TARGET IDX: ", targetIdx);
        //here instead of setting the group to one directly, going to try calling togglePad on it. so commenting out the setState here as well.
        // group[targetIdx] = 1;
        // console.log("i: ", i);
        this.togglePad(i, targetIdx);
      }
    }
    // console.log("nextViewFinal: ", nextView);
    // this.setState({
    //   pads: nextView
    // });
  }

  async generateSeq() {
    try {
      let seedSeq = {
        totalQuantizedSteps: 8,
        quantizationInfo: { stepsPerQuarter: 1 },
        notes: seedNotes
      };
      let resultSeq = await melodyrnn.continueSequence(
        seedSeq,
        8,
        Number(this.state.heat)
      );
      // console.log("RESULT? ", resultSeq);
      //now we can call a helper function which resets the view to new sequence
      this.newView(resultSeq);
    } catch (error) {
      console.log(error);
    }
  }

  play() {
    this.synth = new Synth();
    const { bpm, notes, type, release, delay } = this.state;
    const notesArray = Object.keys(notes).map(key => notes[key]);
    // console.log("NOTES ARRAY: ", notesArray);
    this.setState(() => ({
      playing: true
    }));

    this.interval = setInterval(() => {
      this.setState(
        state => ({
          step: state.step < state.steps - 1 ? state.step + 1 : 0
        }),
        () => {
          if (this.state.step === 0) {
            result = [];
            seedNotes = [];
          }
          const next = this.state.pads[this.state.step]
            .map((pad, i) => (pad === 1 ? notesArray[i] : null))
            .filter(x => x);
          recorder(next);
          this.synth.playNotes(next, {
            release,
            bpm,
            type,
            delay
          });
        }
      );
    }, (60 * 1000) / this.state.bpm / 2);
  }

  showDefault() {
    console.log("the defaultPads are: ", defaultPads);
  }

  pause() {
    this.setState(() => ({
      playing: false,
      step: 0
    }));

    clearInterval(this.interval);
  }

  clearGrid() {
    console.log("inside of clearGrid: ", defaultState);

    this.setState({
      ...defaultState,
      isInitialized: true
    });
    seedNotes = [];
    result = [];
    // defaultPads = [
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    // ];
  }

  togglePad(group, pad) {
    console.log("inside of togglePad: ", "GROUP: ", group, "PAD: ", pad);

    this.setState(state => {
      const clonedPads = state.pads.slice(0);
      console.log("CLONEDPADS: ", clonedPads);
      console.log("CLONED PADS[group]: ", clonedPads[group]);
      const padState = clonedPads[group][pad];

      clonedPads[group] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      clonedPads[group][pad] = padState === 1 ? 0 : 1;
      return {
        pads: clonedPads
      };
    });
  }

  componentWillUnmount() {
    if (this.interval) clearInterval(this.interval);
  }

  handleHeat(event) {
    console.log("you select heat of: ", event);
    this.setState({
      heat: event
    });
  }

  handleStop() {
    this.setState({
      playing: false
    });
    clearInterval(this.interval);
  }

  async startUp() {
    try {
      await melodyrnn.initialize();
      this.setState({
        isInitialized: true
      });
      let dummySeq = {
        totalQuantizedSteps: 4,
        quantizationInfo: { stepsPerQuarter: 1 },
        notes: dummyNotes
      };
      await melodyrnn.continueSequence(dummySeq, 8, 1.1);
    } catch (error) {
      console.log(error);
    }
  }

  render() {
    const { pads, step, notes, isInitialized } = this.state;

    return isInitialized ? (
      <React.StrictMode>
        <div className="container">
          <header>
            <h1>Neural Melody Maker</h1>
          </header>

          <div className="Sequencer">
            <div className="buttons">
              <button
                type="button"
                className={this.state.playing ? "active" : ""}
                onClick={() => {
                  if (this.state.playing) this.pause();
                  else this.play();
                }}
              >
                Play
              </button>

              {/* <div className="select-wrapper">
                <span>Wave</span>
                <select
                  value={this.state.type}
                  data-label="wave"
                  className="wave"
                  onChange={e => this.changeWaveType(e.target.value)}
                >
                  <option>Sine</option>
                  <option>Square</option>
                  <option>Sawtooth</option>
                  <option>Triangle</option>
                </select>
              </div> */}

              <div className="select-wrapper">
                <button
                  //  type="button"
                  className="buttons"
                  onClick={this.generateSeq}
                >
                  Build Melody
                </button>
              </div>

              <div className="select-wrapper">
                <button className="buttons" onClick={this.clearGrid}>
                  Clear
                </button>
              </div>

              {/* <div className="select-wrapper buttons select">
                <span>Heat</span>
                <input
                  type="number"
                  min=".5"
                  max="3"
                  step=".2"
                  defaultValue="1.1"
                  onChange={e => this.handleHeat(e.target.value)}
                />
              </div> */}
              <div className="select-wrapper ">
                <span>Heat</span>
                <select
                  value={this.state.heat}
                  data-label="octave"
                  className="octave"
                  onChange={e => this.handleHeat(e.target.value)}
                >
                  <option>0.5</option>
                  <option>0.7</option>
                  <option>0.9</option>
                  <option>1.1</option>
                  <option>1.3</option>
                  <option>1.5</option>
                  <option>1.7</option>
                  <option>1.9</option>
                  <option>2.1</option>
                  <option>2.3</option>
                  <option>2.5</option>
                  <option>2.7</option>
                  <option>2.9</option>
                </select>
              </div>

              {/* <div className="select-wrapper">
                <span>Release</span>
                <input
                  type="number"
                  min="0"
                  max="400"
                  step="1"
                  defaultValue={this.state.release}
                  onChange={e => this.changeRelease(e.target.value)}
                />
              </div> */}

              {/* <button
                type="button"
                className={cx({ active: this.state.delay })}
                onClick={() => {
                  this.setState(
                    state => ({
                      delay: !state.delay
                    }),
                    () => {
                      this.pause()
                      if (this.state.playing) this.play()
                    }
                  )
                }}
              >
                Delay
              </button> */}
            </div>

            <ul className="notes">
              {Object.keys(notes)
                .slice(0, 12)
                .reverse()
                .map(note => (
                  <li key={`note-${note}`}>{note.slice(0, note.length - 1)}</li>
                ))}
            </ul>

            <div className="flex">
              {pads.map((group, groupIndex) => (
                <div key={`pad-${groupIndex}`} className="pads">
                  {group.map((pad, i) => (
                    <div
                      key={`pad-group-${i}`}
                      className={cx("pad", {
                        active: groupIndex === step,
                        on: pad === 1
                      })}
                      onClick={() => {
                        // this.mouseListener(event);
                        this.togglePad(groupIndex, i);
                      }}
                      onMouseDown={event => true}
                    />
                  ))}
                </div>
              ))}
            </div>
            <br />
            <div className="select-wrapper buttons">
              <div className="select-wrapper bottombtn">
                <span>Octave</span>
                <select
                  value={this.state.octave}
                  data-label="octave"
                  className="octave"
                  onChange={e => this.changeOctave(e.target.value)}
                >
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                  <option>4</option>
                  <option>5</option>
                  <option>6</option>
                  <option>7</option>
                </select>
              </div>
              <div className="select-wrapper bottombtn ">
                <button className="buttons" onClick={this.handleStop}>
                  Stop!
                </button>
                <button onClick={this.showDefault}>defaultPads</button>
              </div>
            </div>
          </div>
        </div>
      </React.StrictMode>
    ) : (
      <h2 className="loading">initializing...</h2>
    );
  }
}

export default Sequencer;
