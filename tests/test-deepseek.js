const DeepSeekFormatter = require("../js/formatter");

console.log("🧠 DeepSeek Response Formatter Test");
console.log("==================================\n");

// Sample DeepSeek response with thinking sections
const sampleResponse = `<think>
The user is asking for a Two Sum solution. Let me think about the approaches:

1. Brute force: O(n²) - check every pair
2. Hash map: O(n) - store complements as we iterate
3. Two pointers: O(n log n) - sort first, then use pointers

The hash map approach is optimal since we need indices, not just values.

I should provide the code first, then explain the complexity.
</think>

Looking at this Two Sum problem, I'll show you the optimal solution.

## Solution

\`\`\`python
def twoSum(nums, target):
    hash_map = {}

    for i, num in enumerate(nums):
        complement = target - num

        if complement in hash_map:
            return [hash_map[complement], i]

        hash_map[num] = i

    return []

# Example usage
nums = [2, 7, 11, 15]
target = 9
result = twoSum(nums, target)
print(f"Result: {result}")  # [0, 1]
\`\`\`

<think>
Let me verify this solution:
1. We iterate through array once
2. For each number, calculate complement
3. If complement exists in hash_map, return indices
4. Otherwise store current number and index

This is definitely O(n) time and O(n) space.
</think>

## How it works

The algorithm uses a hash map to store numbers we've seen and their indices. For each new number, we check if its complement exists in our hash map.

**Time Complexity: O(n)** - Single pass through the array
**Space Complexity: O(n)** - Hash map stores up to n elements

This approach transforms the problem from O(n²) nested loops to O(n) single pass with hash map lookups.`;

// Test the formatter
const formatter = new DeepSeekFormatter();

console.log("📥 ORIGINAL DeepSeek Response:");
console.log("─".repeat(50));
console.log(sampleResponse);

console.log("\n\n📤 FORMATTED Response (Code First, Thinking Last):");
console.log("─".repeat(50));

const result = formatter.formatResponse(sampleResponse);

console.log(result.text);

console.log("\n\n📊 FORMATTING ANALYSIS:");
console.log("─".repeat(30));
console.log(`✅ Original length: ${sampleResponse.length} characters`);
console.log(`✅ Formatted length: ${result.text.length} characters`);
console.log(`✅ Has code: ${result.hasCode ? "YES" : "NO"}`);
console.log(
  `✅ Compression: ${((1 - result.text.length / sampleResponse.length) * 100).toFixed(1)}%`,
);

console.log("\n\n🎯 KEY IMPROVEMENTS:");
console.log("─".repeat(25));
console.log("• CODE appears FIRST for immediate visibility");
console.log("• COMPLEXITY analysis is highlighted with 📊");
console.log("• MAIN EXPLANATIONS follow the code");
console.log("• THINKING process is moved to the END");
console.log("• Response is optimized for coding interviews!");

console.log("\n\n🚀 Perfect for quick code review during interviews!");
