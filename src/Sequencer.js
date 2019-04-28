/* eslint-disable react/no-unused-state, react/no-array-index-key */
import React, { Component } from 'react'
import cx from 'classnames'
import Synth from './Synth'
import NOTES from './notes'
import MNOTES from './mnotes'
import * as mm from '@magenta/music'

const melodyrnn = new mm.MusicRNN(
  'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn'
)
// melodyrnn.initialize() //needs await within an async function

const magentaPlayer = new mm.Player()
let seedNotes = []

//let resultSeq = await melodyrnn.continueSequence(seedSeq, 10, 1.1, ['CM']) // needs to be within an async function

const getNotesForOctave = octave =>
  Object.keys(NOTES).reduce((state, note) => {
    if (note.split('').pop() === String(octave)) state[note] = NOTES[note]
    return state
  }, {})

const defaultPads = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
]

// let lol = {isactive: 0,
//   octave: {this.state.octave}
// }

function swapKeyVal(obj) {
  let swapped = {}
  for (let key in obj) {
    swapped[obj[key]] = key
  }
  return swapped
}

let swappedNOTES = swapKeyVal(NOTES)

let result = []
function recorder(note) {
  if (result.length < 8) {
    result.push(note)
  }
  if (result.length === 8) {
    let count = 0
    console.log('RESULT: ', result)
    const inMidi = result.map(freq => swappedNOTES[freq])
    const inPitch = inMidi.map(midi => MNOTES[midi])
    console.log('IN PITCH: ', inPitch)
    let notes = inPitch.map(pitch => {
      if (pitch) {
        return {
          pitch: pitch,
          quantizedStartStep: count,
          quantizedEndStep: ++count
        }
      } else {
        return {
          pitch: -1,
          quantizedStartStep: count,
          quantizedEndStep: ++count
        }
      }
    })

    //get rid of rests represented by -1
    seedNotes = notes.filter(note => note.pitch !== -1)
    console.log('SEED notes: ', seedNotes)
    // return notes
  }
}

class Sequencer extends Component {
  constructor() {
    super()
    this.state = {
      type: 'sine',
      pads: defaultPads,
      bpm: 150,
      release: 100,
      step: 0,
      steps: 8,
      playing: false,
      octave: 4,
      delay: false,
      notes: getNotesForOctave(4),
      outOfOctave: []
    }

    this.generateSeq = this.generateSeq.bind(this)
    this.newView = this.newView.bind(this)
    this.togglePad = this.togglePad.bind(this)
    this.clearGrid = this.clearGrid.bind(this)
  }

  changeRelease(release) {
    this.setState(
      {
        release
      },
      () => {
        this.pause()
        if (this.state.playing) this.play()
      }
    )
  }

  changeBPM(bpm) {
    if (bpm > 300 || bpm < 60) return

    this.setState(
      () => ({
        bpm
      }),
      () => {
        this.pause()

        if (this.state.playing) this.play()
      }
    )
  }

  changeWaveType(type) {
    this.setState(
      () => ({
        type
      }),
      () => {
        this.pause()

        if (this.state.playing) this.play()
      }
    )
  }

  changeOctave(octave) {
    this.setState(
      {
        octave: Number(octave),
        notes: getNotesForOctave(Number(octave))
      },
      () => {
        this.pause()

        if (this.state.playing) this.play()
      }
    )
  }

  newView(resultSeq) {
    // clear current view to blank
    const { notes } = this.state
    console.log('NOTES: ', notes)
    this.setState({
      pads: defaultPads
    })
    const pitchLookup = swapKeyVal(MNOTES)
    // console.log('HERE: ', Object.keys(notes)).map(note => note.slice(0, -1))
    let midiNoOctave = Object.keys(notes).map(note => note.slice(0, -1))
    const midiIndexObj = swapKeyVal(midiNoOctave)
    // .map(key => notes[key])
    console.log('midi idx obj inside newView: ', midiIndexObj)
    // const midiArray = swapKeyVal(this.state.notes)
    // console.log('MIDI ARRAY: ', midiArray)
    // console.log('this.state.notes', this.state.notes)
    let nextView = defaultPads

    console.log('RESULT SEQ: ', resultSeq)
    let seqForGrid = Array(8).fill(null)
    resultSeq.notes.forEach(
      note => (seqForGrid[note.quantizedStartStep] = note.pitch)
    )
    for (let i = 0; i < this.state.pads.length; i++) {
      const group = nextView[i]
      // console.log('GROUP, i: ', group, i)
      console.log(seqForGrid[i])
      if (seqForGrid[i] !== null) {
        const midiToToggle = pitchLookup[seqForGrid[i]].slice(0, -1)
        // console.log('MIDI to Toggle: ')
        let targetIdx = Number(midiIndexObj[midiToToggle])
        // console.log('TARGET IDX: ', targetIdx)
        group[targetIdx] = 1
        console.log('GROUP AFTER: ', group)
        // group.forEach((item, idx) => console.log('item[idx]: ', item[idx])

        // )
      }
      //so we're in our group, which contains 12 different possible steps to toggle
      //can map each index to a corresponding array which goes from C4 through B4
      //so we can do a nest iteration through the group return only the index whose's value called on state.notes matches the midi to toggle.
      //then we can call togglePad passing in current group and pad index
      // console.log(`${this.state.notes['C4']}`)
    }
    console.log('nextViewFinal: ', nextView)
    this.setState({
      pads: nextView
    })
  }

  async generateSeq() {
    console.log('state.notes ', this.state.notes)
    try {
      let seedSeq = {
        totalQuantizedSteps: 8,
        quantizationInfo: { stepsPerQuarter: 1 },
        notes: seedNotes
      }
      await melodyrnn.initialize()
      let resultSeq = await melodyrnn.continueSequence(seedSeq, 8, 1.1)
      console.log('RESULT? ', resultSeq)
      //now we can call a helper function which resets the view to new sequence
      this.newView(resultSeq)
    } catch (error) {
      console.log(error)
    }
  }

  play() {
    this.synth = new Synth()
    console.log('this.state.notes', this.state.notes)
    const { bpm, notes, type, release, delay } = this.state
    const notesArray = Object.keys(notes).map(key => notes[key])
    console.log('NOTES ARRAY: ', notesArray)
    this.setState(() => ({
      playing: true
    }))

    this.interval = setInterval(() => {
      this.setState(
        state => ({
          step: state.step < state.steps - 1 ? state.step + 1 : 0
        }),
        () => {
          if (this.state.step === 0) {
            result = []
            seedNotes = []
          }
          const next = this.state.pads[this.state.step]
            .map((pad, i) => (pad === 1 ? notesArray[i] : null))
            .filter(x => x)
          // console.log('NEXT: ', next)
          recorder(next)
          this.synth.playNotes(next, {
            release,
            bpm,
            type,
            delay
          })
        }
      )
    }, (60 * 1000) / this.state.bpm / 2)
  }

  pause() {
    this.setState(() => ({
      playing: false,
      step: 0
    }))

    clearInterval(this.interval)
  }

  clearGrid() {
    this.setState({
      pads: defaultPads
    })
    seedNotes = []
    result = []
  }

  togglePad(group, pad) {
    // console.log('GROUP: ', group, 'PAD: ', pad)
    this.setState(state => {
      const clonedPads = state.pads.slice(0)
      // console.log('CLONED PADS[group]: ', clonedPads[group])
      const padState = clonedPads[group][pad]

      clonedPads[group] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      clonedPads[group][pad] = padState === 1 ? 0 : 1
      return {
        pads: clonedPads
      }
    })
  }

  render() {
    const { pads, step, notes } = this.state

    return (
      <React.StrictMode>
        <div className="container">
          <header>
            <h1>Neural Melody</h1>
          </header>

          <div className="Sequencer">
            <div className="buttons">
              <button
                type="button"
                className={this.state.playing ? 'active' : ''}
                onClick={() => {
                  if (this.state.playing) this.pause()
                  else this.play()
                }}
              >
                Play
              </button>

              <div className="select-wrapper">
                <span>BPM</span>
                <input
                  type="number"
                  min="80"
                  max="300"
                  step="1"
                  defaultValue={this.state.bpm}
                  onChange={e => this.changeBPM(e.target.value)}
                />
              </div>

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
              <div className="select-wrapper">
                <button
                  //  type="button"
                  className="buttons"
                  onClick={this.generateSeq}
                >
                  Generate Melody
                </button>
              </div>

              <div className="select-wrapper">
                <button className="buttons" onClick={this.clearGrid}>
                  Clear
                </button>
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
                      className={cx('pad', {
                        active: groupIndex === step,
                        on: pad === 1
                      })}
                      onClick={() => {
                        this.togglePad(groupIndex, i)
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* <footer>
            Made by{' '}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://markmurray.co"
            >
              Mark Murray
            </a>
            . View the source on{' '}
            <a href="https://github.com/markmur/react-sequencer">Github</a>.
          </footer> */}
        </div>
      </React.StrictMode>
    )
  }
}

export default Sequencer
