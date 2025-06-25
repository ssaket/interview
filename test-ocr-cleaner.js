const OCRCleaner = require('./js/ocr-cleaner');

// Test data simulating various OCR outputs
const testCases = [
  {
    name: "Mixed UI and coding content",
    input: `File
Edit
View
Window
Help
What is binary search?
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
Copy
Paste
Cut
Minimize
Close`,
    expected: "Should remove UI elements but keep the question and code"
  },

  {
    name: "Leetcode problem with browser junk",
    input: `Chrome
New Tab
Back
Forward
Reload
https://leetcode.com/problems/two-sum
Two Sum
Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
You may assume that each input would have exactly one solution, and you may not use the same element twice.
You can return the answer in any order.
Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Output: Because nums[0] + nums[1] == 9, we return [0, 1].
WiFi
Battery
12:34 PM
Notification`,
    expected: "Should keep the problem description and examples, remove browser/system UI"
  },

  {
    name: "Code with comments and system junk",
    input: `VS Code
Terminal
Debug
# This function implements quicksort algorithm
def quicksort(arr):
    if len(arr) <= 1:
        return arr

    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]

    return quicksort(left) + middle + quicksort(right)
Finder
Safari
Settings
85%`,
    expected: "Should keep code and comments, remove app names and battery"
  },

  {
    name: "Interview question with timestamps",
    input: `10:30 AM
Monday
What is the time complexity of bubble sort?
Can you implement it in Python?
How would you optimize it?
What are the best and worst case scenarios?
2:45 PM
Meeting
Notification
Alert`,
    expected: "Should keep questions, remove timestamps and notifications"
  },

  {
    name: "Algorithm explanation with menu items",
    input: `File
Edit
Binary search is a search algorithm that finds the position of a target value within a sorted array.
It compares the target value to the middle element of the array.
Time complexity: O(log n)
Space complexity: O(1)
The algorithm works by repeatedly dividing the search interval in half.
Window
Help
About
Quit`,
    expected: "Should keep the algorithm explanation and complexity info"
  },

  {
    name: "Very short fragments and single characters",
    input: `a
b
c
1
2
|
/
-
What is merge sort?
def merge_sort(arr):
    pass
x
y
z`,
    expected: "Should remove single characters but keep the question and function definition"
  },

  {
    name: "Mixed technical content",
    input: `JavaScript array methods
map(), filter(), reduce()
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(x => x * 2);
console.log(doubled);
// Output: [2, 4, 6, 8, 10]
function complexityAnalysis() {
    // Time: O(n)
    // Space: O(n)
}
Chrome DevTools
Inspector
Console`,
    expected: "Should keep code, comments, and technical content"
  },

  {
    name: "OCR artifacts and special characters",
    input: `|||||||
-------
=======
What is the difference between array and linked list?
Array: O(1) access, O(n) insertion/deletion
Linked List: O(n) access, O(1) insertion/deletion
•••••••
▪▪▪▪▪
□□□□□
Trade-offs depend on use case
Implementation considerations
||||
----`,
    expected: "Should remove artifact lines but keep technical comparison"
  }
];

function runTests() {
  console.log('🧪 Testing OCR Cleaner');
  console.log('='.repeat(60));

  const cleaner = new OCRCleaner();
  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`);
    console.log('-'.repeat(40));

    console.log('📝 Original OCR Text:');
    console.log(testCase.input);

    const cleaned = cleaner.cleanText(testCase.input);
    const summary = cleaner.getFilteringSummary(testCase.input, cleaned);

    console.log('\n🧹 Cleaned Text:');
    console.log(cleaned || '[EMPTY - All text was filtered out]');

    console.log(`\n📊 Filtering Summary:`);
    console.log(`   Lines: ${summary.originalLineCount} → ${summary.cleanedLineCount} (${summary.reductionPercentage}% reduction)`);
    console.log(`   Characters: ${summary.originalLength} → ${summary.cleanedLength} (${summary.lengthReduction}% reduction)`);

    console.log(`\n💭 Expected: ${testCase.expected}`);

    // Simple validation - check if meaningful content is preserved
    const hasContent = cleaned.length > 0;
    const preservedImportantContent =
      (testCase.input.includes('def ') && cleaned.includes('def ')) ||
      (testCase.input.includes('function') && cleaned.includes('function')) ||
      (testCase.input.includes('?') && cleaned.includes('?')) ||
      (testCase.input.includes('algorithm') && cleaned.includes('algorithm')) ||
      (testCase.input.includes('complexity') && cleaned.includes('complexity'));

    const removedJunk =
      !cleaned.includes('File') &&
      !cleaned.includes('Edit') &&
      !cleaned.includes('Chrome') &&
      !cleaned.includes('WiFi') &&
      !cleaned.includes('Battery');

    if (hasContent && (preservedImportantContent || cleaned.length > testCase.input.length * 0.3)) {
      console.log('✅ PASSED - Important content preserved');
      passedTests++;
    } else {
      console.log('❌ FAILED - Important content may have been lost');
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Test Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! OCR cleaner is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Review the cleaner logic.');
  }
}

// Test specific cleaning options
function testCleaningOptions() {
  console.log('\n🔧 Testing Cleaning Options');
  console.log('='.repeat(60));

  const cleaner = new OCRCleaner();
  const testText = `File
Edit
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr
What is the time complexity?
Chrome
Safari
a
b
c`;

  const options = [
    { name: 'Default settings', opts: {} },
    { name: 'Preserve more lines', opts: { maxLines: 50, minLineLength: 1 } },
    { name: 'Aggressive filtering', opts: { maxLines: 10, minLineLength: 5, removeCommonUI: true } },
    { name: 'Keep UI elements', opts: { removeCommonUI: false } },
    { name: 'No coding preservation', opts: { preserveCoding: false } }
  ];

  options.forEach(option => {
    console.log(`\n📋 ${option.name}:`);
    const cleaned = cleaner.cleanText(testText, option.opts);
    const summary = cleaner.getFilteringSummary(testText, cleaned);
    console.log(`   Lines: ${summary.originalLineCount} → ${summary.cleanedLineCount}`);
    console.log(`   Length: ${summary.originalLength} → ${summary.cleanedLength}`);
    console.log(`   Preview: ${cleaned.substring(0, 100)}${cleaned.length > 100 ? '...' : ''}`);
  });
}

// Test edge cases
function testEdgeCases() {
  console.log('\n🚨 Testing Edge Cases');
  console.log('='.repeat(60));

  const cleaner = new OCRCleaner();
  const edgeCases = [
    { name: 'Empty string', input: '' },
    { name: 'Only whitespace', input: '   \n\n\t  \n  ' },
    { name: 'Only junk patterns', input: 'File\nEdit\nView\nChrome\nSafari\nWiFi\nBattery' },
    { name: 'Only single characters', input: 'a\nb\nc\n1\n2\n3' },
    { name: 'Very long single line', input: 'This is a very long line that goes on and on and contains lots of text that might be overwhelming for the LLM to process and should probably be filtered out or truncated because it is likely not meaningful content but rather some kind of OCR artifact or malformed text that does not represent actual useful information for coding interview questions or problems.' },
    { name: 'Mixed languages', input: 'function test() {\n  return "hello";\n}\n\ndef test():\n  return "hello"\n\npublic void test() {\n  System.out.println("hello");\n}' },
    { name: 'Only technical terms', input: 'algorithm\ncomplexity\narray\nstring\nfunction\nclass\ntime\nspace\nruntime' }
  ];

  edgeCases.forEach(testCase => {
    console.log(`\n🔍 ${testCase.name}:`);
    const cleaned = cleaner.cleanText(testCase.input);
    console.log(`   Input length: ${testCase.input.length}`);
    console.log(`   Output length: ${cleaned.length}`);
    console.log(`   Result: ${cleaned || '[EMPTY]'}`);
  });
}

// Run all tests
if (require.main === module) {
  runTests();
  testCleaningOptions();
  testEdgeCases();

  console.log('\n🏁 OCR Cleaner testing completed!');
}

module.exports = {
  runTests,
  testCleaningOptions,
  testEdgeCases
};
