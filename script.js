class Sequencer {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.currentStep = 0;
        this.tempo = 120;
        this.intervalId = null;
        this.steps = {
            bass: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            snare: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
        };
        this.volumes = {
            bass: 0.8,
            snare: 0.7
        };
        this.pitches = {
            bass: 60,
            snare: 200
        };
        this.filters = {
            bass: 200,
            snare: 1000
        };
        this.lengths = {
            snare: 200 // in milliseconds
        };
        
        this.initializeAudio();
        this.initializeUI();
        this.setupEventListeners();
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes for mixing
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = 0.7;
            
            console.log('Audio context initialized');
        } catch (error) {
            console.error('Error initializing audio context:', error);
        }
    }

    initializeUI() {
        this.playPauseBtn = document.getElementById('play-pause');
        this.stopBtn = document.getElementById('stop');
        this.clearBtn = document.getElementById('clear');
        this.tempoSlider = document.getElementById('tempo');
        this.tempoValue = document.getElementById('tempo-value');
        this.currentStepIndicator = document.getElementById('current-step');
        this.stepElements = document.querySelectorAll('.step');
        this.bassModal = document.getElementById('bass-modal');
        this.snareModal = document.getElementById('snare-modal');
    }

    setupEventListeners() {
        // Play/Pause button
        this.playPauseBtn.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });

        // Stop button
        this.stopBtn.addEventListener('click', () => {
            this.stop();
        });

        // Clear button
        this.clearBtn.addEventListener('click', () => {
            this.clear();
        });

        // Tempo slider
        this.tempoSlider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            this.tempoValue.textContent = this.tempo;
            if (this.isPlaying) {
                this.stop();
                this.play();
            }
        });

        // Step buttons
        this.stepElements.forEach(step => {
            step.addEventListener('click', () => {
                this.toggleStep(step);
            });
        });

        // Track settings buttons
        document.querySelectorAll('.track-settings-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const track = e.target.dataset.track;
                this.openModal(track);
            });
        });

        // Modal controls
        this.setupModalControls();
    }

    async play() {
        if (!this.audioContext) {
            await this.initializeAudio();
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.isPlaying = true;
        this.playPauseBtn.textContent = '⏸️ Pause';
        this.playPauseBtn.classList.add('playing');

        const stepDuration = (60 / this.tempo) * 0.25; // 16th notes
        this.intervalId = setInterval(() => {
            this.playStep();
            this.currentStep = (this.currentStep + 1) % 16;
            this.updateCurrentStepIndicator();
        }, stepDuration * 1000);
    }

    pause() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶️ Play';
        this.playPauseBtn.classList.remove('playing');
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    stop() {
        this.pause();
        this.currentStep = 0;
        this.updateCurrentStepIndicator();
        this.clearPlayingStates();
    }

    clear() {
        this.stepElements.forEach(step => {
            step.classList.remove('active');
            const track = step.dataset.track;
            const stepIndex = parseInt(step.dataset.step);
            this.steps[track][stepIndex] = false;
        });
    }

    toggleStep(stepElement) {
        const track = stepElement.dataset.track;
        const stepIndex = parseInt(stepElement.dataset.step);
        
        this.steps[track][stepIndex] = !this.steps[track][stepIndex];
        stepElement.classList.toggle('active', this.steps[track][stepIndex]);
    }

    playStep() {
        // Clear previous playing states
        this.clearPlayingStates();

        // Play bass if active
        if (this.steps.bass[this.currentStep]) {
            this.playBass();
            this.highlightStep('bass', this.currentStep);
        }

        // Play snare if active
        if (this.steps.snare[this.currentStep]) {
            this.playSnare();
            this.highlightStep('snare', this.currentStep);
        }
    }

    playBass() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        // Bass sound: low frequency sine wave with envelope
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(this.pitches.bass, this.audioContext.currentTime);

        // Filter for bass character
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.filters.bass, this.audioContext.currentTime);

        // Envelope with volume control
        const maxGain = 0.8 * this.volumes.bass;
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(maxGain, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        // Connect nodes
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Play
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    playSnare() {
        // Create noise buffer for snare with adjustable length
        const duration = this.lengths.snare / 1000; // convert ms to seconds
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);

        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        // Create noise source
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = buffer;

        // Create filter for snare character
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(this.filters.snare, this.audioContext.currentTime);
        filter.Q.setValueAtTime(1, this.audioContext.currentTime);

        // Create gain for envelope with volume control
        const gainNode = this.audioContext.createGain();
        const maxGain = 0.6 * this.volumes.snare;
        const attackTime = Math.min(0.01, duration * 0.1); // 10% of duration or 10ms max
        const decayTime = Math.min(0.15, duration * 0.75); // 75% of duration or 150ms max
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(maxGain, this.audioContext.currentTime + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + decayTime);

        // Add a click for attack
        const clickOsc = this.audioContext.createOscillator();
        const clickGain = this.audioContext.createGain();
        
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(this.pitches.snare, this.audioContext.currentTime);
        
        const clickMaxGain = 0.3 * this.volumes.snare;
        const clickAttackTime = Math.min(0.001, duration * 0.05); // 5% of duration or 1ms max
        const clickDecayTime = Math.min(0.05, duration * 0.25); // 25% of duration or 50ms max
        
        clickGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        clickGain.gain.linearRampToValueAtTime(clickMaxGain, this.audioContext.currentTime + clickAttackTime);
        clickGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + clickDecayTime);

        // Connect nodes
        noiseSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        clickOsc.connect(clickGain);
        clickGain.connect(this.masterGain);

        // Play
        noiseSource.start(this.audioContext.currentTime);
        noiseSource.stop(this.audioContext.currentTime + duration);

        clickOsc.start(this.audioContext.currentTime);
        clickOsc.stop(this.audioContext.currentTime + clickDecayTime);
    }

    highlightStep(track, stepIndex) {
        const stepElement = document.querySelector(`[data-track="${track}"][data-step="${stepIndex}"]`);
        if (stepElement) {
            stepElement.classList.add('playing');
            setTimeout(() => {
                stepElement.classList.remove('playing');
            }, 150);
        }
    }

    clearPlayingStates() {
        this.stepElements.forEach(step => {
            step.classList.remove('playing');
        });
    }

    updateCurrentStepIndicator() {
        const currentStepElement = this.stepElements[this.currentStep];
        
        if (currentStepElement) {
            const rect = currentStepElement.getBoundingClientRect();
            const containerRect = document.querySelector('.sequencer').getBoundingClientRect();
            
            this.currentStepIndicator.style.left = `${rect.left - containerRect.left}px`;
            this.currentStepIndicator.style.top = `${rect.top - containerRect.top}px`;
        }
    }

    setupModalControls() {
        // Bass modal controls
        const bassVolume = document.getElementById('bass-volume');
        const bassPitch = document.getElementById('bass-pitch');
        const bassFilter = document.getElementById('bass-filter');
        const bassVolumeValue = document.getElementById('bass-volume-value');
        const bassPitchValue = document.getElementById('bass-pitch-value');
        const bassFilterValue = document.getElementById('bass-filter-value');

        bassVolume.addEventListener('input', (e) => {
            this.volumes.bass = e.target.value / 100;
            bassVolumeValue.textContent = e.target.value + '%';
        });

        bassPitch.addEventListener('input', (e) => {
            this.pitches.bass = parseInt(e.target.value);
            bassPitchValue.textContent = e.target.value + ' Hz';
        });

        bassFilter.addEventListener('input', (e) => {
            this.filters.bass = parseInt(e.target.value);
            bassFilterValue.textContent = e.target.value + ' Hz';
        });

        // Snare modal controls
        const snareVolume = document.getElementById('snare-volume');
        const snarePitch = document.getElementById('snare-pitch');
        const snareFilter = document.getElementById('snare-filter');
        const snareVolumeValue = document.getElementById('snare-volume-value');
        const snarePitchValue = document.getElementById('snare-pitch-value');
        const snareFilterValue = document.getElementById('snare-filter-value');

        snareVolume.addEventListener('input', (e) => {
            this.volumes.snare = e.target.value / 100;
            snareVolumeValue.textContent = e.target.value + '%';
        });

        snarePitch.addEventListener('input', (e) => {
            this.pitches.snare = parseInt(e.target.value);
            snarePitchValue.textContent = e.target.value + ' Hz';
        });

        snareFilter.addEventListener('input', (e) => {
            this.filters.snare = parseInt(e.target.value);
            snareFilterValue.textContent = e.target.value + ' Hz';
        });

        const snareLength = document.getElementById('snare-length');
        const snareLengthValue = document.getElementById('snare-length-value');

        snareLength.addEventListener('input', (e) => {
            this.lengths.snare = parseInt(e.target.value);
            snareLengthValue.textContent = e.target.value + 'ms';
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal);
            });
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });
    }

    openModal(track) {
        const modal = document.getElementById(`${track}-modal`);
        modal.style.display = 'block';
    }

    closeModal(modal) {
        modal.style.display = 'none';
    }
}

// Initialize sequencer when page loads
document.addEventListener('DOMContentLoaded', () => {
    const sequencer = new Sequencer();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                if (sequencer.isPlaying) {
                    sequencer.pause();
                } else {
                    sequencer.play();
                }
                break;
            case 'Escape':
                sequencer.stop();
                break;
            case 'KeyC':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    sequencer.clear();
                }
                break;
        }
    });
});

// Handle audio context suspension (required by some browsers)
document.addEventListener('click', async () => {
    if (window.sequencer && window.sequencer.audioContext && window.sequencer.audioContext.state === 'suspended') {
        await window.sequencer.audioContext.resume();
    }
}, { once: true });
