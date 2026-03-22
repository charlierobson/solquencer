// Drum Sequencer + Grid Editor Integrated Demo
// - Web Audio scheduler
// - React grid editor
// - Playhead sync

// ------------------------
// Sequencer Core
// ------------------------

class DrumSequencer {
  constructor({ bpm = 120, lookahead = 25, scheduleAheadTime = 0.1, onStep } = {}) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    this.bpm = bpm;
    this.lookahead = lookahead;
    this.scheduleAheadTime = scheduleAheadTime;

    this.currentPattern = null;
    this.isPlaying = false;

    this.currentStep = 0;
    this.nextNoteTime = 0;

    this.timerID = null;

    this.buffers = {};
    this.onStep = onStep; // callback for UI sync
  }

  async loadSample(id, url) {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.buffers[id] = audioBuffer;
  }

  loadPattern(patternJSON) {
    this.currentPattern = patternJSON;
    this.currentStep = 0;
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

  start() {
    if (!this.currentPattern) return;
    if (this.isPlaying) return;

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
// React Grid Editor
// ------------------------

import React, { useState, useEffect, useRef } from "react";

const defaultInstruments = [
  { id: "kick", name: "Kick" },
  { id: "snare", name: "Snare" },
  { id: "hihat", name: "Hi-hat" }
];

function GridEditor({ pattern, onChange, currentStep }) {
  const { timeSignature, subdivision, events, instruments = defaultInstruments } = pattern;

  const totalSteps = timeSignature.numerator * subdivision;

  const isActive = (instrument, step) => {
    return events.some(e => e.instrument === instrument && e.step === step);
  };

  const toggleStep = (instrument, step) => {
    let newEvents;

    if (isActive(instrument, step)) {
      newEvents = events.filter(e => !(e.instrument === instrument && e.step === step));
    } else {
      newEvents = [...events, { instrument, step, velocity: 1 }];
    }

    onChange({ ...pattern, events: newEvents });
  };

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      {instruments.map(inst => (
        <div key={inst.id} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 80 }}>{inst.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${totalSteps}, 24px)`, gap: "2px" }}>
            {Array.from({ length: totalSteps }).map((_, step) => {
              const active = isActive(inst.id, step);
              const isBeatStart = step % subdivision === 0;
              const isCurrent = step === currentStep;

              return (
                <div
                  key={step}
                  onClick={() => toggleStep(inst.id, step)}
                  style={{
                    width: 24,
                    height: 24,
                    cursor: "pointer",
                    background: active ? "black" : "#ddd",
                    border: isBeatStart ? "2px solid #666" : "1px solid #aaa",
                    outline: isCurrent ? "2px solid red" : "none",
                    boxSizing: "border-box"
                  }}
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
// App (Integrated)
// ------------------------

export function App() {
  const [pattern, setPattern] = useState({
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 4,
    instruments: defaultInstruments,
    events: []
  });

  const [currentStep, setCurrentStep] = useState(-1);
  const sequencerRef = useRef(null);

  useEffect(() => {
    const seq = new DrumSequencer({
      bpm: 100,
      onStep: (step) => {
        setCurrentStep(step);
      }
    });

    sequencerRef.current = seq;

    async function load() {
      await seq.loadSample("kick", "/samples/kick.wav");
      await seq.loadSample("snare", "/samples/snare.wav");
      await seq.loadSample("hihat", "/samples/hihat.wav");
    }

    load();
  }, []);

  const start = () => {
    const seq = sequencerRef.current;
    seq.loadPattern(pattern);
    seq.start();
  };

  const stop = () => {
    sequencerRef.current.stop();
    setCurrentStep(-1);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Drum Machine</h2>

      <button onClick={start}>Play</button>
      <button onClick={stop}>Stop</button>

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
