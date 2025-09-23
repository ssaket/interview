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
    
    // Language configuration
    this.language = process.env.ASSEMBLYAI_LANGUAGE || 'en'; // Default to English
    this.useLanguageDetection = process.env.ASSEMBLYAI_AUTO_DETECT === 'true';
    
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
      
      // Detect recording program based on platform
      let recordProgram;
      if (process.platform === 'win32') {
        recordProgram = 'sox'; // Assume sox is in PATH on Windows
      } else if (process.platform === 'darwin') {
        // Try common macOS paths for sox
        const fs = require('fs');
        const possiblePaths = ['/opt/homebrew/bin/sox', '/usr/local/bin/sox', 'sox'];
        recordProgram = possiblePaths.find(path => {
          try {
            return fs.existsSync(path) || path === 'sox';
          } catch {
            return path === 'sox';
          }
        }) || 'sox';
      } else {
        recordProgram = 'sox'; // Default to sox in PATH for Linux
      }

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
        recordProgram: recordProgram,
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
      let errorMessage = `Failed to start recording: ${error.message}`;

      // Provide platform-specific help for common issues
      if (error.message.includes('sox') || error.message.includes('node-record-lpcm16')) {
        if (process.platform === 'win32') {
          errorMessage += '\n\nWindows users: Please install sox audio utility:\n' +
                         '1. Download from https://sourceforge.net/projects/sox/\n' +
                         '2. Add to your system PATH\n' +
                         '3. Restart the application';
        } else if (process.platform === 'darwin') {
          errorMessage += '\n\nmacOS users: Please install sox:\n' +
                         'brew install sox';
        } else {
          errorMessage += '\n\nLinux users: Please install sox:\n' +
                         'sudo apt-get install sox (Ubuntu/Debian)\n' +
                         'sudo yum install sox (CentOS/RHEL)';
        }
      }

      if (this.onError) {
        this.onError(errorMessage);
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
      const transcribeConfig = {
        audio: this.tempAudioPath,
        punctuate: true,
        format_text: true,
        speaker_labels: false,
        // Enhanced English-specific optimizations
        auto_highlights: this.language === 'en', // Only available for English
        filter_profanity: true,
        dual_channel: false,
      };

      // Set language configuration
      if (this.useLanguageDetection) {
        transcribeConfig.language_detection = true;
        console.log('[SpeechToTextService] Using automatic language detection');
      } else {
        transcribeConfig.language_code = this.language;
        console.log(`[SpeechToTextService] Using specified language: ${this.language}`);
      }

      const transcript = await this.client.transcripts.transcribe(transcribeConfig);

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
      isInitialized: !!this.client,
      language: this.language,
      useLanguageDetection: this.useLanguageDetection,
      languageConfig: this.getLanguageConfigDescription()
    };
  }

  /**
   * Get a human-readable description of the language configuration
   * @returns {string} Language configuration description
   */
  getLanguageConfigDescription() {
    if (this.useLanguageDetection) {
      return 'Automatic language detection enabled';
    } else {
      const languageNames = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'nl': 'Dutch',
        'af': 'Afrikaans',
        'sq': 'Albanian',
        'am': 'Amharic',
        'ar': 'Arabic',
        'hy': 'Armenian',
        'as': 'Assamese',
        'az': 'Azerbaijani',
        'ba': 'Bashkir',
        'eu': 'Basque',
        'be': 'Belarusian',
        'bn': 'Bengali',
        'bs': 'Bosnian',
        'br': 'Breton',
        'bg': 'Bulgarian',
        'ca': 'Catalan',
        'zh': 'Chinese',
        'hr': 'Croatian',
        'cs': 'Czech',
        'da': 'Danish',
        'et': 'Estonian',
        'fo': 'Faroese',
        'fi': 'Finnish',
        'gl': 'Galician',
        'ka': 'Georgian',
        'el': 'Greek',
        'gu': 'Gujarati',
        'ht': 'Haitian Creole',
        'ha': 'Hausa',
        'haw': 'Hawaiian',
        'he': 'Hebrew',
        'hi': 'Hindi',
        'hu': 'Hungarian',
        'is': 'Icelandic',
        'id': 'Indonesian',
        'ga': 'Irish',
        'ja': 'Japanese',
        'jw': 'Javanese',
        'kn': 'Kannada',
        'kk': 'Kazakh',
        'km': 'Khmer',
        'ko': 'Korean',
        'lo': 'Lao',
        'la': 'Latin',
        'lv': 'Latvian',
        'ln': 'Lingala',
        'lt': 'Lithuanian',
        'lb': 'Luxembourgish',
        'mk': 'Macedonian',
        'mg': 'Malagasy',
        'ms': 'Malay',
        'ml': 'Malayalam',
        'mt': 'Maltese',
        'mi': 'Maori',
        'mr': 'Marathi',
        'mn': 'Mongolian',
        'my': 'Myanmar',
        'ne': 'Nepali',
        'no': 'Norwegian',
        'nn': 'Norwegian Nynorsk',
        'oc': 'Occitan',
        'pa': 'Panjabi',
        'ps': 'Pashto',
        'fa': 'Persian',
        'pl': 'Polish',
        'ro': 'Romanian',
        'ru': 'Russian',
        'sa': 'Sanskrit',
        'sr': 'Serbian',
        'sn': 'Shona',
        'sd': 'Sindhi',
        'si': 'Sinhala',
        'sk': 'Slovak',
        'sl': 'Slovenian',
        'so': 'Somali',
        'su': 'Sundanese',
        'sw': 'Swahili',
        'sv': 'Swedish',
        'tg': 'Tajik',
        'ta': 'Tamil',
        'tt': 'Tatar',
        'te': 'Telugu',
        'th': 'Thai',
        'bo': 'Tibetan',
        'tr': 'Turkish',
        'tk': 'Turkmen',
        'uk': 'Ukrainian',
        'ur': 'Urdu',
        'uz': 'Uzbek',
        'vi': 'Vietnamese',
        'cy': 'Welsh',
        'yi': 'Yiddish',
        'yo': 'Yoruba'
      };
      
      const languageName = languageNames[this.language] || this.language.toUpperCase();
      return `Fixed language: ${languageName} (${this.language})`;
    }
  }

  /**
   * Set the language for transcription
   * @param {string} languageCode - ISO 639-1 language code (e.g., 'en', 'es', 'fr')
   * @param {boolean} useAutoDetection - Whether to use automatic language detection
   */
  setLanguage(languageCode, useAutoDetection = false) {
    this.language = languageCode;
    this.useLanguageDetection = useAutoDetection;
    console.log(`[SpeechToTextService] Language updated to: ${this.getLanguageConfigDescription()}`);
  }
}

module.exports = SpeechToTextService;