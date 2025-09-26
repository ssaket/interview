const { AssemblyAI } = require('assemblyai');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SimpleSpeechRecorder {
  constructor() {
    this.client = null;
    this.isRecording = false;
    this.recordingProcess = null;
    this.tempAudioPath = null;
    this.onTranscriptReceived = null;
    this.onError = null;
    this.onStatusChange = null;

    this.initializeClient();
  }

  initializeClient() {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey || apiKey === 'your_assemblyai_api_key_here') {
      console.warn('AssemblyAI API key not found');
      return;
    }

    this.client = new AssemblyAI({
      apiKey: apiKey,
    });
    console.log('✅ AssemblyAI client initialized');
  }

  async startRecording() {
    if (this.isRecording) {
      console.log('Already recording');
      return;
    }

    try {
      const record = require('node-record-lpcm16');

      // Create temp file
      const tempDir = app.getPath('temp');
      this.tempAudioPath = path.join(tempDir, `speech_${Date.now()}.wav`);

      // Find sox
      let recordProgram = 'sox';
      if (process.platform === 'darwin') {
        const possiblePaths = ['/opt/homebrew/bin/sox', '/usr/local/bin/sox', 'sox'];
        recordProgram = possiblePaths.find(path => {
          try {
            return fs.existsSync(path) || path === 'sox';
          } catch {
            return path === 'sox';
          }
        }) || 'sox';
      }

      // Start recording
      this.recordingProcess = record.record({
        sampleRate: 16000,
        channels: 1,
        compress: false,
        threshold: 0.5,
        silence: '1.0',
        verbose: false,
        recordProgram: recordProgram,
      });

      const fileStream = fs.createWriteStream(this.tempAudioPath);
      this.recordingProcess.stream().pipe(fileStream);

      this.isRecording = true;
      console.log('🎤 Recording started...');

      if (this.onStatusChange) {
        this.onStatusChange('recording', 'Recording...');
      }

    } catch (error) {
      console.error('Recording error:', error);
      if (this.onError) {
        this.onError(`Recording failed: ${error.message}`);
      }
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.recordingProcess) {
      return;
    }

    try {
      this.recordingProcess.stop();
      this.recordingProcess = null;
      this.isRecording = false;

      console.log('🛑 Recording stopped, processing...');

      if (this.onStatusChange) {
        this.onStatusChange('processing', 'Processing...');
      }

      // Wait then transcribe
      setTimeout(() => {
        this.processRecording();
      }, 1000);

    } catch (error) {
      console.error('Stop recording error:', error);
      if (this.onError) {
        this.onError(`Failed to stop recording: ${error.message}`);
      }
    }
  }

  async processRecording() {
    if (!this.client || !this.tempAudioPath || !fs.existsSync(this.tempAudioPath)) {
      const error = 'No audio file to process';
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
      return;
    }

    try {
      if (this.onStatusChange) {
        this.onStatusChange('transcribing', 'Transcribing...');
      }

      console.log('📝 Transcribing audio...');

      const transcript = await this.client.transcripts.transcribe({
        audio: this.tempAudioPath,
        punctuate: true,
        format_text: true,
      });

      // Cleanup
      try {
        fs.unlinkSync(this.tempAudioPath);
        this.tempAudioPath = null;
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }

      if (transcript.status === 'error') {
        throw new Error(transcript.error);
      }

      const text = transcript.text || '';
      const confidence = transcript.confidence || 0;

      console.log('📝 TRANSCRIPTION RESULT:', text);
      console.log('📊 Confidence:', confidence);

      if (this.onTranscriptReceived) {
        this.onTranscriptReceived(text, {
          confidence: confidence,
          duration: transcript.audio_duration,
        });
      }

      if (this.onStatusChange) {
        this.onStatusChange('completed', `Done (${confidence.toFixed(2)} confidence)`);
      }

    } catch (error) {
      console.error('Transcription error:', error);
      if (this.onError) {
        this.onError(`Transcription failed: ${error.message}`);
      }
      if (this.onStatusChange) {
        this.onStatusChange('error', `Error: ${error.message}`);
      }
    }
  }

  setCallbacks({ onTranscriptReceived, onError, onStatusChange }) {
    this.onTranscriptReceived = onTranscriptReceived;
    this.onError = onError;
    this.onStatusChange = onStatusChange;
  }

  isApiKeyConfigured() {
    return !!process.env.ASSEMBLYAI_API_KEY;
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      hasApiKey: this.isApiKeyConfigured(),
      isInitialized: !!this.client,
    };
  }
}

module.exports = SimpleSpeechRecorder;