import React from 'react';

export default function Instructions({ onBack }) {
  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h1>Drum Sequencer Instructions</h1>
      <p>Welcome to the Solquencer drum machine!</p>
      <p>Here's how to use it:</p>
      <ul>
        <li>Set your BPM (tempo) using the input field.</li>
        <li>Choose time signature: 4/4 or 6/8.</li>
        <li>Click on the grid to add drum hits. Shift+click to cycle velocities.</li>
        <li>Press Play to start the sequence.</li>
        <li>Use Save/Load to export/import patterns.</li>
      </ul>
      <p>Enjoy creating rhythms!</p>
      <button onClick={onBack}>Back to Sequencer</button>
    </div>
  );
}