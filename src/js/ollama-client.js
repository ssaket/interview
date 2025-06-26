const axios = require("axios");

class OllamaClient {
  constructor(baseUrl = "http://localhost:11434", model = "deepseek-r1") {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async chatCompletion(options) {
    const { messages, stream = false } = options;

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: stream,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        },
        {
          timeout: 300000, // 5 minute timeout for reasoning models like DeepSeek R1
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      // Transform Ollama response to match HuggingFace format
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: response.data.message.content,
            },
          },
        ],
      };
    } catch (error) {
      console.error("Ollama API Error:", error.message);

      if (error.code === "ECONNREFUSED") {
        throw new Error(
          "Ollama server not running. Please start with: ollama serve",
        );
      }

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        throw new Error(
          "Ollama response timeout. DeepSeek R1 reasoning model typically takes 60-90 seconds for complex coding questions. This timeout suggests the question was particularly complex or system resources are limited.",
        );
      }

      if (error.response) {
        if (error.response.status === 404) {
          throw new Error(
            `Model '${this.model}' not found. Please pull it with: ollama pull ${this.model}`,
          );
        }
        throw new Error(
          `Ollama API error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`,
        );
      }

      throw new Error(`Ollama request failed: ${error.message}`);
    }
  }

  async checkConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });

      const models = response.data.models || [];
      const hasModel = models.some((model) => model.name.includes(this.model));

      return {
        connected: true,
        modelAvailable: hasModel,
        availableModels: models.map((m) => m.name),
      };
    } catch (error) {
      return {
        connected: false,
        modelAvailable: false,
        error: error.message,
      };
    }
  }

  async pullModel(modelName = this.model) {
    try {
      console.log(
        `Pulling model ${modelName}... This may take several minutes.`,
      );
      const response = await axios.post(
        `${this.baseUrl}/api/pull`,
        {
          name: modelName,
        },
        {
          timeout: 600000, // 10 minute timeout for model pulling
        },
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error("Error pulling model:", error.message);
      throw new Error(`Failed to pull model ${modelName}: ${error.message}`);
    }
  }

  async warmupModel() {
    console.log(`Warming up model ${this.model}...`);
    try {
      const startTime = Date.now();
      await this.chatCompletion({
        messages: [
          {
            role: "user",
            content: "Just say 'Ready' in one word.",
          },
        ],
        stream: false,
      });
      const duration = Date.now() - startTime;
      console.log(`Model warmup completed in ${duration}ms`);
      return { success: true, duration };
    } catch (error) {
      console.error("Model warmup failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  async chatCompletionWithProgress(options, progressCallback) {
    const { messages, stream = false } = options;

    console.log(`Starting ${this.model} inference...`);
    if (progressCallback) {
      progressCallback("Starting inference...");
    }

    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: stream,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        },
        {
          timeout: 300000, // 5 minute timeout
          headers: {
            "Content-Type": "application/json",
          },
          onUploadProgress: () => {
            if (progressCallback) {
              progressCallback("Request sent, waiting for response...");
            }
          },
        },
      );

      const duration = Date.now() - startTime;
      console.log(`${this.model} responded in ${duration}ms`);

      if (progressCallback) {
        progressCallback(
          `Response received in ${Math.round(duration / 1000)}s`,
        );
      }

      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: response.data.message.content,
            },
          },
        ],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`${this.model} failed after ${duration}ms:`, error.message);

      if (progressCallback) {
        progressCallback(`Failed after ${Math.round(duration / 1000)}s`);
      }

      throw error;
    }
  }
}

module.exports = OllamaClient;
