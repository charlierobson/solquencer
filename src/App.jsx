// App.jsx — Complete working file
// - Web Audio sequencer (lookahead scheduling)
// - Grid editor with 4/4 and 6/8
// - Step labels (1 e & a / 1 la li)
// - Live editing + BPM control + playhead

import React, { useState, useEffect, useRef } from "react";

import kickSample from './assets/samples/kick.wav';
import snareSample from './assets/samples/snare.wav';
import hihatSample from './assets/samples/hihat.wav';

// ------------------------
// Sequencer Core
// ------------------------

class DrumSequencer {
  constructor({ bpm = 120, lookahead = 25, scheduleAheadTime = 0.1, onStep } = {}) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    this.bpm = bpm;
    this.lookahead = lookahead; // ms
    this.scheduleAheadTime = scheduleAheadTime; // seconds

    this.currentPattern = null;
    this.isPlaying = false;

    this.currentStep = 0;
    this.nextNoteTime = 0;

    this.timerID = null;
    this.buffers = {};
    this.onStep = onStep;
  }

  async loadSample(id, url) {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.buffers[id] = audioBuffer;
  }

  loadPattern(patternJSON) {
    this.currentPattern = patternJSON;
  }

  get secondsPerBeat() {
    return 60 / this.bpm;
  }

  get totalSteps() {
    const { timeSignature, subdivision } = this.currentPattern;
    return timeSignature.numerator * subdivision;
  }

  scheduleNote(step, time) {
    if (this.onStep) this.onStep(step, time);

    const events = this.currentPattern.events.filter(e => e.step === step);

    events.forEach(event => {
      const buffer = this.buffers[event.instrument];
      if (!buffer) return;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = event.velocity ?? 1;

      source.connect(gainNode).connect(this.audioContext.destination);
      source.start(time);
    });
  }

  nextStep() {
    const stepDuration = this.secondsPerBeat / this.currentPattern.subdivision;

    this.nextNoteTime += stepDuration;
    this.currentStep++;

    if (this.currentStep >= this.totalSteps) {
      this.currentStep = 0;
    }
  }

  scheduler() {
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.nextStep();
    }

    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  async start() {
    if (!this.currentPattern) return;
    if (this.isPlaying) return;

    await this.audioContext.resume();

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.audioContext.currentTime;

    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerID);
  }
}

// ------------------------
// Grid Editor
// ------------------------

const defaultInstruments = [
  { id: "kick", name: "Kick" },
  { id: "snare", name: "Snare" },
  { id: "hihat", name: "Hi-hat" }
];

function GridEditor({ pattern, onChange, currentStep }) {
  const { timeSignature, subdivision, events, instruments = defaultInstruments } = pattern;

  const totalSteps = timeSignature.numerator * subdivision;
  const groupSize = subdivision;

  const getEvent = (instrument, step) => {
    return events.find(e => e.instrument === instrument && e.step === step);
  };

  const isActive = (instrument, step) => !!getEvent(instrument, step);

  const cycleVelocity = (v) => {
    const levels = [0.25, 0.5, 0.75, 1];
    const idx = levels.findIndex(x => Math.abs(x - (v ?? 0)) < 0.001);
    return levels[(idx + 1) % levels.length];
  };

  const toggleStep = (instrument, step, shiftKey) => {
    const existing = getEvent(instrument, step);
    let newEvents;

    if (shiftKey) {
      // cycle velocity (create if missing)
      if (existing) {
        const newVel = cycleVelocity(existing.velocity ?? 1);
        newEvents = events.map(e =>
          e.instrument === instrument && e.step === step
            ? { ...e, velocity: newVel }
            : e
        );
      } else {
        newEvents = [...events, { instrument, step, velocity: 0.25 }];
      }
    } else {
      // normal toggle on/off (default velocity 1)
      if (existing) {
        newEvents = events.filter(e => !(e.instrument === instrument && e.step === step));
      } else {
        newEvents = [...events, { instrument, step, velocity: 1 }];
      }
    }

    onChange({ ...pattern, events: newEvents });
  };

  const getLabel = (step) => {
    const beat = Math.floor(step / subdivision) + 1;
    const sub = step % subdivision;

    if (subdivision === 4) {
      const labels = ["", "e", "&", "a"];
      return sub === 0 ? String(beat) : labels[sub];
    }

    if (subdivision === 3) {
      const labels = ["", "la", "li"];
      return sub === 0 ? String(beat) : labels[sub];
    }

    return "";
  };

  const velToGrey = (v) => {
    // 0.25 -> light, 1 -> black
    const level = v ?? 0;
    const shade = Math.round(255 - level * 255);
    return `rgb(${shade}, ${shade}, ${shade})`;
  };

  return (
    <div style={{ display: "grid", gap: "6px" }}>

      {/* Step labels row */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ width: 80 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${totalSteps}, 24px)`,
            gap: "2px",
            marginBottom: "4px"
          }}
        >
          {Array.from({ length: totalSteps }).map((_, step) => {
            const isGroupStart = step % groupSize === 0;

            return (
              <div
                key={step}
                style={{
                  width: 24,
                  height: 16,
                  fontSize: 10,
                  textAlign: "center",
                  fontWeight: step % groupSize === 0 ? "bold" : "normal",
                  borderLeft: isGroupStart ? "3px solid #444" : "1px solid transparent"
                }}
              >
                {getLabel(step)}
              </div>
            );
          })}
        </div>
      </div>

      {instruments.map(inst => (
        <div key={inst.id} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 80 }}>{inst.name}</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${totalSteps}, 24px)`,
              gap: "2px"
            }}
          >
            {Array.from({ length: totalSteps }).map((_, step) => {
              const ev = getEvent(inst.id, step);
              const active = !!ev;
              const isCurrent = step === currentStep;

              const isGroupStart = step % groupSize === 0;
              const isAltGroup = Math.floor(step / groupSize) % 2 === 1;

              return (
                <div
                  key={step}
                  onClick={(e) => toggleStep(inst.id, step, e.shiftKey)}
                  style={{
                    width: 24,
                    height: 24,
                    cursor: "pointer",
                    background: isCurrent
                      ? "orange"
                      : active
                      ? velToGrey(ev.velocity)
                      : isAltGroup
                      ? "#cfcfcf"
                      : "#e4e4e4",
                    borderLeft: isGroupStart ? "3px solid #444" : "1px solid #aaa",
                    borderTop: "1px solid #aaa",
                    borderRight: "1px solid #aaa",
                    borderBottom: "1px solid #aaa",
                    boxSizing: "border-box"
                  }}
                  title={active ? `vel: ${ev.velocity}` : ""}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------
// App
// ------------------------

export default function App() {
  const [pattern, setPattern] = useState({
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 4,
    instruments: defaultInstruments,
    events: []
  });

  const [bpm, setBpm] = useState(100);
  const [currentStep, setCurrentStep] = useState(-1);

  const sequencerRef = useRef(null);

  useEffect(() => {
    const seq = new DrumSequencer({
      bpm,
      onStep: (step) => setCurrentStep(step)
    });

    sequencerRef.current = seq;

    async function load() {
      await seq.loadSample("kick", "/samples/kick.wav");
      await seq.loadSample("snare", "/samples/snare.wav");
      await seq.loadSample("hihat", "/samples/hihat.wav");
    }

    load();
  }, []);

  useEffect(() => {
    if (sequencerRef.current) {
      sequencerRef.current.loadPattern(pattern);
    }
  }, [pattern]);

  useEffect(() => {
    if (sequencerRef.current) {
      sequencerRef.current.bpm = bpm;
    }
  }, [bpm]);

  const start = () => {
    const seq = sequencerRef.current;
    seq.loadPattern(pattern);
    seq.start();
  };

  const stop = () => {
    sequencerRef.current.stop();
    setCurrentStep(-1);
  };

  const setFourFour = () => {
    setPattern(prev => ({
      ...prev,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 4,
      events: []
    }));
  };

  const setSixEight = () => {
    setPattern(prev => ({
      ...prev,
      timeSignature: { numerator: 6, denominator: 8 },
      subdivision: 3,
      events: []
    }));
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Drum Machine</h2>

      <div style={{ marginBottom: 10 }}>
        BPM:
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          style={{ marginLeft: 10, width: 60 }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <button onClick={setFourFour}>4/4</button>
        <button onClick={setSixEight} style={{ marginLeft: 10 }}>6/8</button>
      </div>

      <button onClick={start}>Play</button>
      <button onClick={stop} style={{ marginLeft: 10 }}>Stop</button>

      <GridEditor
        pattern={pattern}
        onChange={setPattern}
        currentStep={currentStep}
      />

      <pre style={{ marginTop: 20 }}>
        {JSON.stringify(pattern, null, 2)}
      </pre>
    </div>
  );
}
