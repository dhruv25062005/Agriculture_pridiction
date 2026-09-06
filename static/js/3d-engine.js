// ==========================================
// 🌌 3D INTERACTIVE ENGINE & CARD PERSPECTIVE SYSTEM
// ==========================================

export function init3DBackground() {
  // Background video has been removed per specification
}

export function init3DEffects() {
  const cards = document.querySelectorAll(".card-3d, .stat-3d, .auth-card, .widget-3d, .hero-card-3d, .commodity-card");

  cards.forEach(card => {
    // Avoid double initialization
    if (card.dataset.tiltInit === "true") return;
    card.dataset.tiltInit = "true";

    function handleMouseEnter() {
      card.style.transition = "transform 0.25s ease-out, box-shadow 0.25s ease, border-color 0.25s ease";
    }

    function handleMouseMove(e) {
      const bounds = card.getBoundingClientRect();
      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;

      const halfWidth = bounds.width / 2;
      const halfHeight = bounds.height / 2;

      // Subdued micro-tilt (gentle 1.5 degrees) for clean, non-intrusive depth
      const maxTilt = 1.5;
      const rotateX = -((mouseY - halfHeight) / halfHeight) * maxTilt;
      const rotateY = ((mouseX - halfWidth) / halfWidth) * maxTilt;

      card.style.transform = `perspective(1600px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
    }

    function handleMouseLeave() {
      card.style.transition = "transform 0.35s ease, box-shadow 0.3s ease, border-color 0.3s ease";
      card.style.transform = "perspective(1600px) rotateX(0deg) rotateY(0deg) translateY(0px)";
    }

    card.addEventListener("mouseenter", handleMouseEnter);
    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
  });
}

// ==========================================
// 🔊 VOICE READOUT & SPEECH SYNTHESIS ENGINE
// ==========================================
class SpeechController {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
  }

  speak(text, lang = "en-US", onStart, onEnd) {
    if (!this.synth) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }

    this.stop();

    if (!text || text.trim() === "") return;

    // Clean markdown and emojis for smooth pronunciation
    const cleanText = text
      .replace(/[*_#`~]/g, "")
      .replace(/[🌱🦠🌦️🧪🌾📈💰📖🚪⚡🔊📸📷👁️💧📊🌬️🌤️☁️🌧️❄️⛈️✅❌⚠️]/g, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Set matching voice if available
    const voices = this.synth.getVoices();
    const targetLangPrefix = lang.split("-")[0];
    const matchingVoice = voices.find(v => v.lang.startsWith(targetLangPrefix) || v.lang.startsWith(lang));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.lang = lang;
    utterance.rate = 0.95; // Slightly measured pace for agricultural terminology
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isPlaying = true;
      if (onStart) onStart();
      showVoiceToast(true, "🔊 Speaking diagnosis and field advisory...");
    };

    utterance.onend = () => {
      this.isPlaying = false;
      if (onEnd) onEnd();
      showVoiceToast(false);
    };

    utterance.onerror = (e) => {
      console.warn("Speech error:", e);
      this.isPlaying = false;
      if (onEnd) onEnd();
      showVoiceToast(false);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    showVoiceToast(false);
  }
}

export const speechEngine = new SpeechController();

function showVoiceToast(show, message = "") {
  let toast = document.getElementById("voiceAudioToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "voiceAudioToast";
    toast.className = "voice-toast";
    toast.innerHTML = `
      <div class="voice-wave">
        <span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span>
      </div>
      <span id="voiceToastMsg"></span>
      <button id="voiceStopBtn" onclick="window.stopAudioReadout()">⏹ Stop</button>
    `;
    document.body.appendChild(toast);
  }

  const msgSpan = document.getElementById("voiceToastMsg");
  if (msgSpan) msgSpan.innerText = message;

  if (show) {
    toast.classList.add("show");
  } else {
    toast.classList.remove("show");
  }
}

window.stopAudioReadout = () => {
  speechEngine.stop();
};

// Initialize when DOM content is loaded
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    init3DEffects();
    // 3D background video is only initialized on template.html explicitly
  });
}
