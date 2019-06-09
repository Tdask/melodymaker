/* eslint-disable react/no-unused-state, react/no-array-index-key */
import React, { Component } from "react";
import cx from "classnames";
import Synth from "./Synth";
import MNOTES from "./mnotes";
import * as mm from "@magenta/music";
import {
  dummyNotes,
  defaultPads,
  defaultState,
  swapKeyVal,
  getNotesForOctave,
  swappedNOTES
} from "./helpers";

let result = [];
let seedNotes = [];
function recorder(note) {
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

const melodyrnn = new mm.MusicRNN(
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn"
);

class Sequencer extends Component {
  constructor() {
    super();
    this.state = {
      ...defaultState
    };
    this.generateSeq = this.generateSeq.bind(this);
    this.newView = this.newView.bind(this);
    this.togglePad = this.togglePad.bind(this);
    this.clearGrid = this.clearGrid.bind(this);
    this.startUp = this.startUp.bind(this);
    this.handleHeat = this.handleHeat.bind(this);
    this.handleStop = this.handleStop.bind(this);
  }

  componentDidMount() {
    this.startUp();
  }

  async startUp() {
    try {
      await melodyrnn.initialize();
      this.setState({
        isInitialized: true
      });
      //priming the model to prevent random first output
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

  play() {
    this.synth = new Synth();
    const { bpm, notes, type, release, delay } = this.state;
    const notesArray = Object.keys(notes).map(key => notes[key]);
    this.setState(() => ({
      playing: true
    }));

    this.interval = setInterval(() => {
      this.setState(
        state => ({
          step: state.step < state.steps - 1 ? state.step + 1 : 0
        }),
        () => {
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
      //now we call newView function which sets the view to new sequence
      this.newView(resultSeq);
    } catch (error) {
      console.log(error);
    }
  }

  newView(resultSeq) {
    const { notes } = this.state;
    const pitchLookup = swapKeyVal(MNOTES);
    let midiNoOctave = Object.keys(notes).map(note => note.slice(0, -1));
    const midiIndexObj = swapKeyVal(midiNoOctave);

    //make a new sequence that can be triggered by grid
    let seqForGrid = Array(8).fill(null);
    resultSeq.notes.forEach(
      note => (seqForGrid[note.quantizedStartStep] = note.pitch)
    );
    for (let i = 0; i < this.state.pads.length; i++) {
      if (seqForGrid[i]) {
        const midiToToggle = pitchLookup[seqForGrid[i]].slice(0, -1);
        let targetIdx = Number(midiIndexObj[midiToToggle]);

        //calling toggle
        this.togglePad(i, targetIdx);
      }
    }
  }

  togglePad(group, pad) {
    this.setState(state => {
      const clonedPads = state.pads.slice(0);
      const padState = clonedPads[group][pad];

      clonedPads[group] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      clonedPads[group][pad] = padState === 1 ? 0 : 1;
      return {
        pads: clonedPads
      };
    });
  }

  pause() {
    this.setState(() => ({
      playing: false,
      step: 0
    }));

    clearInterval(this.interval);
  }

  clearGrid() {
    this.setState({
      pads: defaultPads
    });
    seedNotes = [];
    result = [];
  }

  componentWillUnmount() {
    if (this.interval) clearInterval(this.interval);
  }

  handleHeat(event) {
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

              <div className="select-wrapper">
                <button className="buttons" onClick={this.generateSeq}>
                  Build Melody
                </button>
              </div>

              <div className="select-wrapper">
                <button className="buttons" onClick={this.clearGrid}>
                  Clear
                </button>
              </div>

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
                        this.togglePad(groupIndex, i);
                      }}
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
