const readline = require('readline');
const fs = require('fs');
const path = require('path');
const ResponseFormatter = require('./formatter');

class FormatterConfigurator {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.config = {
      removeVerboseIntros: true,
      highlightCode: true,
      emphasizeComplexity: true,
      compressWhitespace: true,
      maxSectionLength: 500,
      supportedLanguages: ['python', 'javascript', 'java', 'cpp', 'c', 'go', 'rust', 'sql', 'html', 'css'],
      verbosePatterns: [
        "^(Let me|I'll|I will|I can|I'd be happy to|Sure!|Certainly!|Of course!)",
        "^(Here's how|Here is how|This is how|The way to)",
        "^(First, let me|To start with|Let's begin by)",
        "^(As you can see|As shown|As demonstrated)",
        "^(In this example|For example|For instance)",
        "^(It's worth noting|Note that|Keep in mind)",
        "^(I hope this helps|This should help|Hope this clarifies)"
      ],
      stylePreferences: {
        codeBlockStyle: 'bordered',
        complexityIcon: '📊',
        headerStyle: 'underlined',
        inlineCodeStyle: 'highlighted'
      }
    };

    this.sampleResponses = [
      {
        name: "Python Algorithm",
        text: `Let me help you solve this! Here's a clean Python solution:

\`\`\`python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
\`\`\`

Time Complexity: O(log n)
Space Complexity: O(1)

I hope this helps!`
      },
      {
        name: "JavaScript Function",
        text: `Sure! I can help you implement a debounce function.

\`\`\`javascript
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}
\`\`\`

This is quite useful for performance optimization.`
      }
    ];
  }

  async start() {
    console.log('\n🎛️  Response Formatter Configuration Tool');
    console.log('==========================================\n');

    await this.loadExistingConfig();
    await this.mainMenu();
  }

  async mainMenu() {
    const choices = [
      '1. View Current Configuration',
      '2. Test Formatting with Sample Data',
      '3. Configure Verbose Pattern Removal',
      '4. Configure Code Highlighting',
      '5. Configure Complexity Emphasis',
      '6. Configure Style Preferences',
      '7. Add Custom Test Response',
      '8. Save Configuration',
      '9. Load Configuration',
      '10. Reset to Defaults',
      '0. Exit'
    ];

    console.log('\n📋 Main Menu:');
    choices.forEach(choice => console.log(`   ${choice}`));

    const answer = await this.ask('\nSelect an option: ');

    switch(answer.trim()) {
      case '1': await this.viewConfiguration(); break;
      case '2': await this.testFormatting(); break;
      case '3': await this.configureVerbosePatterns(); break;
      case '4': await this.configureCodeHighlighting(); break;
      case '5': await this.configureComplexity(); break;
      case '6': await this.configureStyles(); break;
      case '7': await this.addCustomResponse(); break;
      case '8': await this.saveConfiguration(); break;
      case '9': await this.loadConfiguration(); break;
      case '10': await this.resetDefaults(); break;
      case '0':
        console.log('\n👋 Goodbye!');
        this.rl.close();
        return;
      default:
        console.log('❌ Invalid option. Please try again.');
    }

    if (answer.trim() !== '0') {
      await this.mainMenu();
    }
  }

  async viewConfiguration() {
    console.log('\n📊 Current Configuration:');
    console.log('========================');

    console.log(`\n🧹 Verbose Intro Removal: ${this.config.removeVerboseIntros ? '✅' : '❌'}`);
    console.log(`📝 Code Highlighting: ${this.config.highlightCode ? '✅' : '❌'}`);
    console.log(`⚡ Complexity Emphasis: ${this.config.emphasizeComplexity ? '✅' : '❌'}`);
    console.log(`🗜️  Whitespace Compression: ${this.config.compressWhitespace ? '✅' : '❌'}`);
    console.log(`📏 Max Section Length: ${this.config.maxSectionLength} chars`);

    console.log(`\n🔤 Supported Languages: ${this.config.supportedLanguages.join(', ')}`);

    console.log(`\n🎨 Style Preferences:`);
    Object.entries(this.config.stylePreferences).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });

    console.log(`\n📝 Verbose Patterns (${this.config.verbosePatterns.length} patterns):`);
    this.config.verbosePatterns.slice(0, 3).forEach((pattern, i) => {
      console.log(`   ${i + 1}. ${pattern}`);
    });
    if (this.config.verbosePatterns.length > 3) {
      console.log(`   ... and ${this.config.verbosePatterns.length - 3} more`);
    }

    await this.ask('\nPress Enter to continue...');
  }

  async testFormatting() {
    console.log('\n🧪 Test Formatting');
    console.log('==================');

    // Show available samples
    console.log('\nAvailable test responses:');
    this.sampleResponses.forEach((sample, i) => {
      console.log(`${i + 1}. ${sample.name}`);
    });

    const choice = await this.ask('\nSelect a response to test (number): ');
    const index = parseInt(choice) - 1;

    if (index < 0 || index >= this.sampleResponses.length) {
      console.log('❌ Invalid selection.');
      return;
    }

    const sample = this.sampleResponses[index];
    const formatter = this.createFormatterWithCurrentConfig();

    console.log(`\n📥 Original Response (${sample.text.length} chars):`);
    console.log('─'.repeat(50));
    console.log(sample.text);

    const result = formatter.formatResponse(sample.text);

    console.log(`\n📤 Formatted Response (${result.text.length} chars):`);
    console.log('─'.repeat(50));
    console.log(result.text);

    const compression = ((1 - result.text.length / sample.text.length) * 100).toFixed(1);
    console.log(`\n📊 Analysis:`);
    console.log(`   Compression: ${compression}%`);
    console.log(`   Has Code: ${result.hasCode ? '✅' : '❌'}`);
    console.log(`   Original: ${sample.text.length} chars`);
    console.log(`   Formatted: ${result.text.length} chars`);

    await this.ask('\nPress Enter to continue...');
  }

  async configureVerbosePatterns() {
    console.log('\n🧹 Configure Verbose Pattern Removal');
    console.log('====================================');

    const toggle = await this.ask(`\nVerbose removal is currently ${this.config.removeVerboseIntros ? 'ON' : 'OFF'}. Toggle? (y/n): `);
    if (toggle.toLowerCase() === 'y') {
      this.config.removeVerboseIntros = !this.config.removeVerboseIntros;
      console.log(`✅ Verbose removal ${this.config.removeVerboseIntros ? 'enabled' : 'disabled'}`);
    }

    if (this.config.removeVerboseIntros) {
      console.log('\nCurrent patterns:');
      this.config.verbosePatterns.forEach((pattern, i) => {
        console.log(`${i + 1}. ${pattern}`);
      });

      const action = await this.ask('\nActions: (a)dd pattern, (r)emove pattern, (c)lear all, or (s)kip: ');

      switch(action.toLowerCase()) {
        case 'a':
          const newPattern = await this.ask('Enter new regex pattern: ');
          if (newPattern.trim()) {
            this.config.verbosePatterns.push(newPattern.trim());
            console.log('✅ Pattern added');
          }
          break;
        case 'r':
          const removeIndex = await this.ask('Enter pattern number to remove: ');
          const idx = parseInt(removeIndex) - 1;
          if (idx >= 0 && idx < this.config.verbosePatterns.length) {
            this.config.verbosePatterns.splice(idx, 1);
            console.log('✅ Pattern removed');
          }
          break;
        case 'c':
          const confirm = await this.ask('Clear all patterns? (y/n): ');
          if (confirm.toLowerCase() === 'y') {
            this.config.verbosePatterns = [];
            console.log('✅ All patterns cleared');
          }
          break;
      }
    }
  }

  async configureCodeHighlighting() {
    console.log('\n📝 Configure Code Highlighting');
    console.log('=============================');

    const toggle = await this.ask(`\nCode highlighting is currently ${this.config.highlightCode ? 'ON' : 'OFF'}. Toggle? (y/n): `);
    if (toggle.toLowerCase() === 'y') {
      this.config.highlightCode = !this.config.highlightCode;
      console.log(`✅ Code highlighting ${this.config.highlightCode ? 'enabled' : 'disabled'}`);
    }

    if (this.config.highlightCode) {
      console.log(`\nSupported languages: ${this.config.supportedLanguages.join(', ')}`);

      const action = await this.ask('\nActions: (a)dd language, (r)emove language, or (s)kip: ');

      switch(action.toLowerCase()) {
        case 'a':
          const newLang = await this.ask('Enter language name: ');
          if (newLang.trim() && !this.config.supportedLanguages.includes(newLang.trim().toLowerCase())) {
            this.config.supportedLanguages.push(newLang.trim().toLowerCase());
            console.log('✅ Language added');
          }
          break;
        case 'r':
          const removeLang = await this.ask('Enter language to remove: ');
          const langIndex = this.config.supportedLanguages.indexOf(removeLang.trim().toLowerCase());
          if (langIndex > -1) {
            this.config.supportedLanguages.splice(langIndex, 1);
            console.log('✅ Language removed');
          }
          break;
      }
    }
  }

  async configureComplexity() {
    console.log('\n⚡ Configure Complexity Emphasis');
    console.log('===============================');

    const toggle = await this.ask(`\nComplexity emphasis is currently ${this.config.emphasizeComplexity ? 'ON' : 'OFF'}. Toggle? (y/n): `);
    if (toggle.toLowerCase() === 'y') {
      this.config.emphasizeComplexity = !this.config.emphasizeComplexity;
      console.log(`✅ Complexity emphasis ${this.config.emphasizeComplexity ? 'enabled' : 'disabled'}`);
    }

    if (this.config.emphasizeComplexity) {
      console.log(`\nCurrent complexity icon: ${this.config.stylePreferences.complexityIcon}`);
      const newIcon = await this.ask('Enter new complexity icon (or press Enter to keep current): ');
      if (newIcon.trim()) {
        this.config.stylePreferences.complexityIcon = newIcon.trim();
        console.log('✅ Icon updated');
      }
    }
  }

  async configureStyles() {
    console.log('\n🎨 Configure Style Preferences');
    console.log('=============================');

    console.log('\nCurrent styles:');
    Object.entries(this.config.stylePreferences).forEach(([key, value], i) => {
      console.log(`${i + 1}. ${key}: ${value}`);
    });

    const choice = await this.ask('\nSelect style to modify (number), or press Enter to skip: ');
    const index = parseInt(choice) - 1;
    const keys = Object.keys(this.config.stylePreferences);

    if (index >= 0 && index < keys.length) {
      const key = keys[index];
      const currentValue = this.config.stylePreferences[key];
      const newValue = await this.ask(`Enter new value for ${key} (current: ${currentValue}): `);

      if (newValue.trim()) {
        this.config.stylePreferences[key] = newValue.trim();
        console.log('✅ Style updated');
      }
    }
  }

  async addCustomResponse() {
    console.log('\n➕ Add Custom Test Response');
    console.log('===========================');

    const name = await this.ask('Enter response name: ');
    if (!name.trim()) return;

    console.log('\nEnter the response text (type "END" on a new line to finish):');
    let text = '';
    let line;

    while ((line = await this.ask('')) !== 'END') {
      text += line + '\n';
    }

    if (text.trim()) {
      this.sampleResponses.push({
        name: name.trim(),
        text: text.trim()
      });
      console.log('✅ Custom response added');
    }
  }

  async saveConfiguration() {
    console.log('\n💾 Save Configuration');
    console.log('====================');

    const filename = await this.ask('Enter filename (without extension): ');
    if (!filename.trim()) return;

    const filepath = path.join(__dirname, `${filename.trim()}.config.json`);

    try {
      fs.writeFileSync(filepath, JSON.stringify(this.config, null, 2));
      console.log(`✅ Configuration saved to ${filepath}`);
    } catch (error) {
      console.log(`❌ Error saving configuration: ${error.message}`);
    }
  }

  async loadConfiguration() {
    console.log('\n📂 Load Configuration');
    console.log('====================');

    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.config.json'));

    if (files.length === 0) {
      console.log('❌ No configuration files found');
      return;
    }

    console.log('\nAvailable configurations:');
    files.forEach((file, i) => {
      console.log(`${i + 1}. ${file}`);
    });

    const choice = await this.ask('\nSelect configuration to load (number): ');
    const index = parseInt(choice) - 1;

    if (index >= 0 && index < files.length) {
      try {
        const filepath = path.join(__dirname, files[index]);
        const loadedConfig = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        this.config = { ...this.config, ...loadedConfig };
        console.log('✅ Configuration loaded');
      } catch (error) {
        console.log(`❌ Error loading configuration: ${error.message}`);
      }
    }
  }

  async resetDefaults() {
    console.log('\n🔄 Reset to Defaults');
    console.log('===================');

    const confirm = await this.ask('Are you sure you want to reset all settings? (y/n): ');
    if (confirm.toLowerCase() === 'y') {
      this.config = new FormatterConfigurator().config;
      console.log('✅ Configuration reset to defaults');
    }
  }

  async loadExistingConfig() {
    const configPath = path.join(__dirname, 'formatter.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.config = { ...this.config, ...existingConfig };
        console.log('📂 Loaded existing configuration');
      } catch (error) {
        console.log('⚠️  Could not load existing configuration, using defaults');
      }
    }
  }

  createFormatterWithCurrentConfig() {
    const formatter = new ResponseFormatter();

    // Apply current configuration to formatter
    if (!this.config.removeVerboseIntros) {
      formatter.verbosePatterns = [];
    } else {
      formatter.verbosePatterns = this.config.verbosePatterns.map(p => new RegExp(p, 'i'));
    }

    formatter.codeLanguages = this.config.supportedLanguages;

    return formatter;
  }

  ask(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
}

// Export for use in other modules
module.exports = FormatterConfigurator;

// Run if executed directly
if (require.main === module) {
  const configurator = new FormatterConfigurator();
  configurator.start().catch(console.error);
}
