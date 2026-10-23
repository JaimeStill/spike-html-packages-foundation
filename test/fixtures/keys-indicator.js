// A pending-sequence indicator built outside keys from its keys-sequence events alone: the presses
// so far in #indicator, cleared when the sequence ends. It proves the extension point.
// From spike-html-design v0.7.0 (fe75220): test/fixtures/keys-indicator.js, its header cut.

document.addEventListener("keys-sequence", ({ detail }) => {
  const indicator = document.getElementById("indicator");
  if (!indicator) return;
  indicator.textContent = detail.state === "end" ? "" : detail.presses.join(" then ");
});
