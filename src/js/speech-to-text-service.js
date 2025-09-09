const { AssemblyAI } = require('assemblyai');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SpeechToTextService {
  constructor() {
    this.client = null;
    this.isRecording = false;
    this.recordingProcess = null;
    this.onTranscriptReceived = null;
    this.onError = null;
    this.onStatusChange = null;
    this.tempAudioPath = null;
    
    this.initializeClient();
  }

  initializeClient() {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      console.warn('AssemblyAI API key not found in environment variables');
      return;
    }
    
    this.client = new AssemblyAI({
      apiKey: apiKey
    });
  }

  async startRecording() {
    if (this.isRecording) {
      console.log('Already recording');
      return;
    }

    try {
      const record = require('node-record-lpcm16');
      
      // Create temporary file path
      const tempDir = app.getPath('temp');
      this.tempAudioPath = path.join(tempDir, `speech_${Date.now()}.wav`);
      
      // Create write stream for the audio file
      const fileStream = fs.createWriteStream(this.tempAudioPath);
      
      // Start recording
      this.recordingProcess = record.record({
        sampleRate: 16000,
        channels: 1,
        compress: false,
        threshold: 0.5,
        thresholdStart: null,
        thresholdEnd: null,
        silence: '1.0',
        verbose: false,
        recordProgram: '/opt/homebrew/bin/sox', // Full path to sox
      });

      // Pipe the recording to the file
      this.recordingProcess.stream().pipe(fileStream);

      this.recordingProcess.stream().on('error', (error) => {
        console.error('Recording stream error:', error);
        if (this.onError) {
          this.onError(`Recording failed: ${error.message}`);
        }
      });

      this.isRecording = true;
      
      if (this.onStatusChange) {
        this.onStatusChange('recording', 'Recording started...');
      }
      
      console.log('Speech recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      if (this.onError) {
        this.onError(`Failed to start recording: ${error.message}`);
      }
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.recordingProcess) {
      console.log('Not currently recording');
      return;
    }

    try {
      // Stop the recording process
      this.recordingProcess.stop();
      this.recordingProcess = null;
      this.isRecording = false;
      
      if (this.onStatusChange) {
        this.onStatusChange('processing', 'Processing audio...');
      }
      
      console.log('Speech recording stopped');
      
      // Wait a moment for the file to be written, then process
      setTimeout(() => {
        this.processRecording();
      }, 1000);
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      if (this.onError) {
        this.onError(`Failed to stop recording: ${error.message}`);
      }
    }
  }

  async processRecording() {
    if (!this.client) {
      const error = 'AssemblyAI client not initialized. Please check your API key.';
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
      return;
    }

    if (!this.tempAudioPath || !fs.existsSync(this.tempAudioPath)) {
      const error = 'No audio file found';
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
      return;
    }

    try {
      if (this.onStatusChange) {
        this.onStatusChange('transcribing', 'Transcribing audio with AssemblyAI...');
      }

      // Upload and transcribe
      const transcript = await this.client.transcripts.transcribe({
        audio: this.tempAudioPath,
        language_detection: true,
        punctuate: true,
        format_text: true,
        speaker_labels: false
      });

      // Clean up temp file
      try {
        await fs.promises.unlink(this.tempAudioPath);
        this.tempAudioPath = null;
      } catch (cleanupError) {
        console.warn('Failed to clean up temp audio file:', cleanupError);
      }

      if (transcript.status === 'error') {
        throw new Error(transcript.error);
      }

      const transcriptText = transcript.text || '';
      const confidence = transcript.confidence || 0;
      
      console.log('Transcription completed:', {
        text: transcriptText,
        confidence: confidence,
        duration: transcript.audio_duration
      });

      if (this.onTranscriptReceived) {
        this.onTranscriptReceived(transcriptText, {
          confidence: confidence,
          duration: transcript.audio_duration,
          language: transcript.language_code
        });
      }

      if (this.onStatusChange) {
        this.onStatusChange('completed', `Transcription completed (${confidence.toFixed(2)} confidence)`);
      }

    } catch (error) {
      console.error('Error processing audio:', error);
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
      isInitialized: !!this.client
    };
  }
}

module.exports = SpeechToTextService;