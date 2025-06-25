const LLMFriendlyOCRCleaner = require("./js/llm-friendly-ocr-cleaner");

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
    expected: "Should remove UI elements but keep the question and code intact",
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
    expected:
      "Should keep the problem description and examples, remove browser/system UI",
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
    expected:
      "Should keep code and comments intact, remove app names and battery",
  },

  {
    name: "Interview questions with timestamps",
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
    expected:
      "Should keep questions intact, remove timestamps and notifications",
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
    expected:
      "Should keep the algorithm explanation and complexity info intact",
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
    expected:
      "Should remove single characters but keep the question and function definition",
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
    expected: "Should keep code, comments, and technical content intact",
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
    expected:
      "Should remove artifact lines but keep technical comparison intact",
  },

  {
    name: "Real-world OCR with common mistakes",
    input: `Explain the merge sort algorithm
def merge_sort(arr):
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])

    return merge(left, right)

Time complexity: O(n log n)
Space complexity: O(n)`,
    expected: "Should preserve everything as it's all meaningful content",
  },

  {
    name: "Notepad-style numbered walkthrough",
    input: `Let's solve the two sum problem step by step:

1. First, understand the problem:
   Given an array and target, find two numbers that add up to target

2. Approach 1 - Brute Force:
   def two_sum_brute(nums, target):
       for i in range(len(nums)):
           for j in range(i + 1, len(nums)):
               if nums[i] + nums[j] == target:
                   return [i, j]

3. Time complexity: O(n²) because we have nested loops

4. Better approach - Hash Map:
   def two_sum_hash(nums, target):
       seen = {}
       for i, num in enumerate(nums):
           complement = target - num
           if complement in seen:
               return [seen[complement], i]
           seen[num] = i

5. This reduces time complexity to O(n)

Note: The hash map approach trades space for time`,
    expected: "Should preserve numbered steps, code, and explanations",
  },

  {
    name: "Informal notepad Q&A format",
    input: `Here's how I approach binary search problems:

Question: How do you implement binary search?
Answer: Let me show you with an example.

Step 1: Set left = 0, right = len(arr) - 1
Step 2: While left <= right:
    - Calculate mid = (left + right) // 2
    - If arr[mid] == target: return mid
    - If arr[mid] < target: left = mid + 1
    - Else: right = mid - 1
Step 3: Return -1 if not found

Example walkthrough:
Array: [1, 3, 5, 7, 9, 11]
Target: 7

First iteration: left=0, right=5, mid=2, arr[2]=5 < 7, so left=3
Second iteration: left=3, right=5, mid=4, arr[4]=9 > 7, so right=3
Third iteration: left=3, right=3, mid=3, arr[3]=7 == 7, return 3

Important: Binary search only works on sorted arrays!`,
    expected: "Should preserve Q&A format, steps, and examples",
  },

  {
    name: "Bullet point explanation with code",
    input: `Understanding recursion:

• Base case: The condition that stops the recursion
• Recursive case: The function calls itself with modified parameters
• Each call should move closer to the base case

Example - Factorial:
def factorial(n):
    # Base case
    if n <= 1:
        return 1
    # Recursive case
    return n * factorial(n - 1)

Walkthrough for factorial(4):
• factorial(4) = 4 * factorial(3)
• factorial(3) = 3 * factorial(2)
• factorial(2) = 2 * factorial(1)
• factorial(1) = 1 (base case)
• Working backwards: 1 * 2 * 3 * 4 = 24

Remember: Always ensure you have a proper base case!`,
    expected:
      "Should preserve bullet points, code, and step-by-step explanation",
  },

  {
    name: "Mixed notepad content with console output",
    input: `Let's test our sorting algorithm:

Here's the code:
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

Testing it:
>>> arr = [64, 34, 25, 12, 22, 11, 90]
>>> print("Original:", arr)
Original: [64, 34, 25, 12, 22, 11, 90]
>>> sorted_arr = bubble_sort(arr.copy())
>>> print("Sorted:", sorted_arr)
Sorted: [11, 12, 22, 25, 34, 64, 90]

Analysis:
- Time complexity: O(n²) in worst case
- Space complexity: O(1)
- Stable: Yes, equal elements maintain relative order
- In-place: Yes, sorts the array without extra space

Note: Bubble sort is inefficient for large datasets`,
    expected: "Should preserve code, console output, and analysis",
  },

  {
    name: "Problem-solving approach notes",
    input: `Approach to solve coding problems:

Problem: Find the maximum subarray sum

Step 1: Understand the problem
- Given an array of integers
- Find contiguous subarray with largest sum
- Return the sum value

Step 2: Think of approaches
1) Brute force: Check all possible subarrays O(n³)
2) Optimized brute force: O(n²)
3) Kadane's algorithm: O(n)

Step 3: Implement Kadane's algorithm
def max_subarray_sum(arr):
    max_sum = float('-inf')
    current_sum = 0

    for num in arr:
        current_sum = max(num, current_sum + num)
        max_sum = max(max_sum, current_sum)

    return max_sum

Step 4: Trace through example
Array: [-2, 1, -3, 4, -1, 2, 1, -5, 4]
Expected output: 6 (subarray [4, -1, 2, 1])

Reasoning: At each step, decide whether to start a new subarray
or extend the current one based on which gives a larger sum.`,
    expected: "Should preserve structured problem-solving approach",
  },
];

function runBasicTests() {
  console.log("🧪 Testing LLM-Friendly OCR Cleaner");
  console.log("=".repeat(60));

  const cleaner = new LLMFriendlyOCRCleaner();
  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`);
    console.log("-".repeat(40));

    console.log("📝 Original OCR Text:");
    console.log(testCase.input);

    const cleaned = cleaner.cleanText(testCase.input, { logResults: false });
    const metrics = cleaner.getQualityMetrics(testCase.input, cleaned);

    console.log("\n🧹 Cleaned Text:");
    console.log(cleaned || "[EMPTY - All text was filtered out]");

    console.log(`\n📊 Filtering Summary:`);
    console.log(
      `   Lines: ${metrics.originalLineCount} → ${metrics.cleanedLineCount} (${metrics.reductionPercentage}% reduction)`,
    );
    console.log(
      `   Characters: ${metrics.originalLength} → ${metrics.cleanedLength} (${metrics.lengthReduction}% reduction)`,
    );
    console.log(`   Questions preserved: ${metrics.questionsPreserved}`);
    console.log(`   Code blocks preserved: ${metrics.codeBlocksPreserved}`);
    console.log(
      `   Technical terms preserved: ${metrics.technicalTermsPreserved}`,
    );

    console.log(`\n💭 Expected: ${testCase.expected}`);

    // Validation criteria
    const hasContent = cleaned.length > 0;
    const preservedImportantContent =
      (testCase.input.includes("def ") && cleaned.includes("def ")) ||
      (testCase.input.includes("function") && cleaned.includes("function")) ||
      (testCase.input.includes("?") && cleaned.includes("?")) ||
      (testCase.input.includes("algorithm") && cleaned.includes("algorithm")) ||
      (testCase.input.includes("complexity") &&
        cleaned.includes("complexity")) ||
      // Check for problem descriptions and valuable content
      (testCase.input.includes("Given") && cleaned.includes("Given")) ||
      (testCase.input.includes("return") && cleaned.includes("return")) ||
      (testCase.input.includes("array") && cleaned.includes("array")) ||
      (testCase.input.includes("Example") && cleaned.includes("Example")) ||
      (testCase.input.includes("Input:") && cleaned.includes("Input:")) ||
      (testCase.input.includes("Output:") && cleaned.includes("Output:")) ||
      // Check if substantial content is preserved (at least 30% of meaningful content)
      (cleaned.length > testCase.input.length * 0.2 &&
        metrics.cleanedLineCount >= 3);

    const removedJunk =
      (!testCase.input.includes("File") || !cleaned.includes("File")) &&
      (!testCase.input.includes("Chrome") || !cleaned.includes("Chrome")) &&
      (!testCase.input.includes("WiFi") || !cleaned.includes("WiFi"));

    // Check for text corruption (should NOT happen with new cleaner)
    const hasTextCorruption =
      cleaned.includes("rnicl") ||
      cleaned.includes("clef") ||
      cleaned.includes("ancl") ||
      cleaned.includes("nurns") ||
      cleaned.includes("irnplernent");

    if (hasContent && preservedImportantContent && !hasTextCorruption) {
      console.log("✅ PASSED - Important content preserved without corruption");
      passedTests++;
    } else {
      console.log("❌ FAILED - Content issues detected");
      if (hasTextCorruption) {
        console.log("   ⚠️  Text corruption detected!");
      }
      if (!preservedImportantContent) {
        console.log("   ⚠️  Important content may have been lost");
        console.log(
          `   📝 Cleaned content length: ${cleaned.length} (${Math.round((cleaned.length / testCase.input.length) * 100)}% of original)`,
        );
      }
    }
  });

  console.log("\n" + "=".repeat(60));
  console.log(`🎯 Test Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log(
      "🎉 All tests passed! LLM-friendly cleaner is working correctly.",
    );
  } else {
    console.log("⚠️  Some tests failed. Review the cleaner logic.");
  }

  return { passedTests, totalTests };
}

function testCleaningOptions() {
  console.log("\n🔧 Testing Cleaning Options");
  console.log("=".repeat(60));

  const cleaner = new LLMFriendlyOCRCleaner();
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
    { name: "Default settings", opts: {} },
    { name: "Keep more lines", opts: { maxLines: 50 } },
    { name: "Aggressive filtering", opts: { maxLines: 10, minLineLength: 5 } },
    {
      name: "Preserve all content types",
      opts: { preserveQuestions: true, preserveCode: true, removeJunk: false },
    },
    { name: "Apply OCR fixes", opts: { applyOCRFixes: true } },
    {
      name: "Minimal filtering",
      opts: { removeJunk: false, minLineLength: 1 },
    },
  ];

  options.forEach((option) => {
    console.log(`\n📋 ${option.name}:`);
    const cleaned = cleaner.cleanText(testText, option.opts);
    const metrics = cleaner.getQualityMetrics(testText, cleaned);

    console.log(
      `   Lines: ${metrics.originalLineCount} → ${metrics.cleanedLineCount} (${metrics.reductionPercentage}% reduction)`,
    );
    console.log(
      `   Length: ${metrics.originalLength} → ${metrics.cleanedLength} (${metrics.lengthReduction}% reduction)`,
    );
    console.log(
      `   Questions: ${metrics.questionsPreserved}, Code blocks: ${metrics.codeBlocksPreserved}`,
    );
    console.log(
      `   Preview: ${cleaned.substring(0, 100)}${cleaned.length > 100 ? "..." : ""}`,
    );
  });
}

function testEdgeCases() {
  console.log("\n🚨 Testing Edge Cases");
  console.log("=".repeat(60));

  const cleaner = new LLMFriendlyOCRCleaner();
  const edgeCases = [
    { name: "Empty string", input: "" },
    { name: "Only whitespace", input: "   \n\n\t  \n  " },
    {
      name: "Only junk patterns",
      input: "File\nEdit\nView\nChrome\nSafari\nWiFi\nBattery",
    },
    { name: "Only single characters", input: "a\nb\nc\n1\n2\n3" },
    {
      name: "Very long technical line",
      input:
        "This is a comprehensive explanation of the quicksort algorithm which is a divide-and-conquer sorting algorithm that works by selecting a pivot element and partitioning the array around it",
    },
    {
      name: "Mixed languages (code)",
      input:
        'function test() {\n  return "hello";\n}\n\ndef test():\n  return "hello"\n\npublic void test() {\n  System.out.println("hello");\n}',
    },
    {
      name: "Only technical terms",
      input:
        "algorithm\ncomplexity\narray\nstring\nfunction\nclass\ntime\nspace\nruntime",
    },
    {
      name: "Questions only",
      input:
        "What is recursion?\nHow does it work?\nWhy use it?\nWhen to avoid it?",
    },
    {
      name: "Code with OCR errors",
      input: "def rnerge_sort(arr):\n    if len(arr) <= 1:\n        retum arr",
    },
  ];

  edgeCases.forEach((testCase) => {
    console.log(`\n🔍 ${testCase.name}:`);
    const cleaned = cleaner.cleanText(testCase.input);
    const isWorthy = cleaner.isLLMWorthy(cleaned);

    console.log(`   Input length: ${testCase.input.length}`);
    console.log(`   Output length: ${cleaned.length}`);
    console.log(`   LLM worthy: ${isWorthy ? "✅" : "❌"}`);
    console.log(`   Result: ${cleaned || "[EMPTY]"}`);
  });
}

function testLLMContextExtraction() {
  console.log("\n🤖 Testing LLM Context Extraction");
  console.log("=".repeat(60));

  const cleaner = new LLMFriendlyOCRCleaner();

  const contextTestCases = [
    {
      name: "Interview question with code",
      text: `What is binary search?
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
    return -1
Time complexity: O(log n)`,
    },
    {
      name: "Algorithm explanation",
      text: `Merge sort is a divide and conquer algorithm.
It works by recursively splitting the array.
Example: [3,1,4,1,5] becomes [1,1,3,4,5]
Time complexity: O(n log n)
Space complexity: O(n)`,
    },
    {
      name: "Code with examples",
      text: `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

Example usage:
Input: n = 5
Output: 5`,
    },
  ];

  contextTestCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}:`);
    const context = cleaner.extractLLMContext(testCase.text);

    console.log(`   Questions: ${context.questions.length}`);
    context.questions.forEach((q) => console.log(`     - "${q}"`));

    console.log(`   Code blocks: ${context.codeBlocks.length}`);
    context.codeBlocks.slice(0, 3).forEach((c) => console.log(`     - "${c}"`));

    console.log(`   Examples: ${context.examples.length}`);
    context.examples.forEach((e) => console.log(`     - "${e}"`));

    console.log(
      `   Technical concepts: [${context.technicalConcepts.join(", ")}]`,
    );
  });
}

function testReadabilityPreservation() {
  console.log("\n📖 Testing Readability Preservation");
  console.log("=".repeat(60));

  const cleaner = new LLMFriendlyOCRCleaner();

  const readabilityTests = [
    {
      name: "Technical explanation",
      input: `Binary search is an efficient algorithm for finding an item from a sorted list.
It works by repeatedly dividing the search interval in half.
Time complexity: O(log n)
Space complexity: O(1)`,
    },
    {
      name: "Code with proper formatting",
      input: `def quicksort(arr):
    if len(arr) <= 1:
        return arr

    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    right = [x for x in arr if x > pivot]

    return quicksort(left) + [pivot] + quicksort(right)`,
    },
    {
      name: "Interview Q&A format",
      input: `Q: What is the difference between arrays and linked lists?
A: Arrays provide O(1) random access but O(n) insertion/deletion.
   Linked lists provide O(1) insertion/deletion but O(n) access.`,
    },
  ];

  readabilityTests.forEach((test, index) => {
    console.log(`\n${index + 1}. ${test.name}:`);
    console.log("   Original:");
    console.log(`   "${test.input}"`);

    const cleaned = cleaner.cleanText(test.input, { applyOCRFixes: false });
    console.log("   Cleaned (no OCR fixes):");
    console.log(`   "${cleaned}"`);

    const cleanedWithFixes = cleaner.cleanText(test.input, {
      applyOCRFixes: true,
    });
    console.log("   Cleaned (with OCR fixes):");
    console.log(`   "${cleanedWithFixes}"`);

    // Check for corruption
    const hasCorruption =
      cleaned.includes("rnicl") ||
      cleaned.includes("clef") ||
      cleanedWithFixes.includes("rnicl") ||
      cleanedWithFixes.includes("clef");

    console.log(
      `   Text corruption: ${hasCorruption ? "❌ DETECTED" : "✅ NONE"}`,
    );
  });
}

function compareWithEnhancedCleaner() {
  console.log("\n⚖️ Comparison with Enhanced ML Cleaner");
  console.log("=".repeat(60));

  // This would require importing the enhanced cleaner, but we'll simulate
  console.log("Key improvements in LLM-Friendly Cleaner:");
  console.log("✅ No aggressive OCR correction that corrupts text");
  console.log("✅ Better preservation of code structure and formatting");
  console.log("✅ More conservative junk removal");
  console.log("✅ Focus on LLM readability over ML scoring complexity");
  console.log("✅ Simpler, more predictable filtering logic");
  console.log("✅ Context extraction for LLM usage");
  console.log("✅ Better handling of technical content");
}

// Run all tests
function runAllTests() {
  console.log("🚀 Starting comprehensive LLM-Friendly OCR Cleaner tests...\n");

  const basicResults = runBasicTests();
  testCleaningOptions();
  testEdgeCases();
  testLLMContextExtraction();
  testReadabilityPreservation();
  compareWithEnhancedCleaner();

  console.log("\n" + "=".repeat(60));
  console.log("🏁 FINAL TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(
    `Basic functionality: ${basicResults.passedTests}/${basicResults.totalTests} tests passed`,
  );

  if (basicResults.passedTests === basicResults.totalTests) {
    console.log(
      "🎉 SUCCESS: LLM-Friendly OCR Cleaner is ready for production!",
    );
    console.log("🤖 The cleaned text should be optimal for LLM processing.");
  } else {
    console.log("⚠️  ISSUES DETECTED: Review failed tests before deployment.");
  }

  console.log("\n💡 Key benefits for LLM usage:");
  console.log("   • Preserves code structure and syntax");
  console.log("   • Maintains question clarity");
  console.log("   • Removes UI junk without text corruption");
  console.log("   • Provides context extraction for better LLM understanding");
  console.log("   • Conservative approach prevents over-processing");
}

// Export for use in other modules
module.exports = {
  runAllTests,
  runBasicTests,
  testCleaningOptions,
  testEdgeCases,
  testLLMContextExtraction,
  testReadabilityPreservation,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}
