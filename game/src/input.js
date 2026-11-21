// Keyboard + mouse input, read once per frame into a plain state object.
// World mouse coordinates are filled in by main.js from the camera.
export function makeInput() {
  return {
    up: false, down: false, left: false, right: false,
    sprint: false, handbrake: false, shoot: false,
    enterPressed: false, boostPressed: false,
    keys: new Set(),
  };
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'handbrake',
};

export function attachInput(input, canvas, onFirstGesture, onKey) {
  window.addEventListener('keydown', (e) => {
    onFirstGesture();
    if (e.code === 'KeyE' && !e.repeat) input.enterPressed = true;
    if (e.code === 'ShiftLeft' && !e.repeat) input.boostPressed = true;
    const field = KEYMAP[e.code];
    if (field) {
      input[field] = true;
      e.preventDefault();
    }
    input.keys.add(e.code);
    if (onKey) onKey(e.code, true);
  });
  window.addEventListener('keyup', (e) => {
    const field = KEYMAP[e.code];
    if (field) input[field] = false;
    input.keys.delete(e.code);
    if (onKey) onKey(e.code, false);
  });
  canvas.addEventListener('mousedown', (e) => {
    onFirstGesture();
    if (e.button === 0) input.shoot = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.shoot = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.sprint = input.handbrake = input.shoot = false;
  });
}
