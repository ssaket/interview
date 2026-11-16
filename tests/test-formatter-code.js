/**
 * Test Suite: Formatter code extraction
 *
 * Verifies the code-only view (Cmd/Ctrl+Shift+L) for Go answers:
 * 1. ```go and ```golang blocks are extracted, and ```python blocks still are
 * 2. Short snippets are skipped
 * 3. A response with no code says so
 * 4. highlightGo escapes HTML and makes one span for each token
 */

const InterviewCodeFormatter = require('../src/js/formatter');

let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    failures++;
    console.error(`❌ ${name}\n   ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const formatter = new InterviewCodeFormatter();

const goSolution = [
  'func twoSum(nums []int, target int) []int {',
  '\tseen := map[int]int{}',
  '\tfor i, n := range nums {',
  '\t\tif j, ok := seen[target-n]; ok {',
  '\t\t\treturn []int{j, i}',
  '\t\t}',
  '\t\tseen[n] = i',
  '\t}',
  '\treturn nil',
  '}',
].join('\n');

test('code-only view extracts a ```go block and keeps the go fence', () => {
  const result = formatter.formatResponse(`### Optimized Solution\n\`\`\`go\n${goSolution}\n\`\`\``);
  assert(result.hasCode, 'no code found');
  assert(result.text.includes('```go\nfunc twoSum'), `go fence missing:\n${result.text}`);
});

test('code-only view treats ```golang as go', () => {
  const result = formatter.formatResponse(`\`\`\`golang\n${goSolution}\n\`\`\``);
  assert(result.text.includes('```go\nfunc twoSum'), `golang block not shown as go:\n${result.text}`);
});

test('code-only view still extracts ```python blocks', () => {
  const python = 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n' +
    '        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i';
  const result = formatter.formatResponse(`\`\`\`python\n${python}\n\`\`\``);
  assert(result.text.includes('```python\ndef two_sum'), `python block missing:\n${result.text}`);
});

test('code-only view skips snippets under the minimum length', () => {
  const result = formatter.formatResponse('```go\nx := 1\n```');
  assert(!result.hasCode, 'short snippet was treated as code');
  assert(result.text.includes('Go code blocks'), `no-code message is wrong:\n${result.text}`);
});

test('Go code counts as algorithm code (func, method, struct)', () => {
  assert(formatter.isAlgorithmCode('func (l *Lot) Park(v Vehicle) error {'), 'method not found');
  assert(formatter.isAlgorithmCode('type Lot struct {\n\tspots []Spot\n}'), 'struct not found');
});

test('highlightGo escapes HTML and makes one span for each token', () => {
  const html = formatter.highlightGo('s := "<b>" // if <x>\nreturn nil');
  assert(html.includes('<span class="string">&quot;&lt;b&gt;&quot;</span>'), `string: ${html}`);
  assert(html.includes('<span class="comment">// if &lt;x&gt;</span>'), `comment: ${html}`);
  assert(html.includes('<span class="keyword">return</span>'), `keyword: ${html}`);
  assert(!html.includes('<span class="keyword">if</span>'), `keyword inside a comment: ${html}`);
});

test('highlightGo keeps a // in a raw string as part of the string', () => {
  const html = formatter.highlightGo('u := `http://x`');
  assert(html.includes('<span class="string">`http://x`</span>'), `raw string: ${html}`);
});

console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} formatter code test(s) failed`);
  process.exit(1);
}
console.log('🎉 All formatter code tests passed');
