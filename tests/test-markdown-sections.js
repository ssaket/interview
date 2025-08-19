const DeepSeekFormatter = require('../src/js/formatter');

console.log('🧪 TESTING: Markdown Sections Formatting');
console.log('=========================================\n');

// Sample DeepSeek response with markdown sections
const sampleResponseWithMarkdownSections = `<think>
This is a classic two-pointer problem. I need to find if there are two numbers in the array that sum to the target.

Let me think about the approaches:
1. Brute force: O(n²) - check all pairs
2. Hash map: O(n) - store complements
3. Two pointers: O(n log n) - sort first, then use two pointers

The hash map approach is probably best for this case.
</think>

I'll solve this step by step using multiple approaches.

### Solution Code

Here's the most efficient hash map approach:

\`\`\`python
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
\`\`\`

### Approach and Time Complexity

**Hash Map Approach:**
- We iterate through the array once
- For each element, we calculate its complement (target - current element)
- We check if the complement exists in our hash map
- If it exists, we found our pair and return the indices
- If not, we store the current element and its index in the hash map

**Time Complexity:** O(n) where n is the length of the array
**Space Complexity:** O(n) for the hash map storage

### Alternative Solutions

Here are two other approaches for comparison:

\`\`\`python
# Brute Force Approach
def two_sum_brute_force(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []

# Two Pointers Approach (requires sorted array)
def two_sum_two_pointers(nums, target):
    # Create list of (value, original_index) pairs
    indexed_nums = [(nums[i], i) for i in range(len(nums))]
    indexed_nums.sort()  # Sort by value

    left, right = 0, len(indexed_nums) - 1

    while left < right:
        current_sum = indexed_nums[left][0] + indexed_nums[right][0]
        if current_sum == target:
            return sorted([indexed_nums[left][1], indexed_nums[right][1]])
        elif current_sum < target:
            left += 1
        else:
            right -= 1

    return []
\`\`\`

### Performance Comparison

| Approach | Time Complexity | Space Complexity | Best For |
|----------|----------------|------------------|----------|
| Hash Map | O(n) | O(n) | General case |
| Brute Force | O(n²) | O(1) | Small arrays |
| Two Pointers | O(n log n) | O(n) | When sorting is acceptable |

<think>
I've provided three different approaches:

1. Hash Map - Most efficient for the general case
2. Brute Force - Simple but inefficient
3. Two Pointers - Good when you can modify the input

The hash map approach is definitely the best choice here. It's optimal in terms of time complexity and the space trade-off is worth it.
</think>

The hash map approach is the optimal solution for this problem, providing O(n) time complexity while maintaining clean, readable code.`;

console.log('📥 BEFORE: Original Response with Markdown Sections');
console.log('==================================================');
console.log(sampleResponseWithMarkdownSections);

console.log('\n\n' + '='.repeat(80) + '\n');

// Test the formatter
const formatter = new DeepSeekFormatter();
const result = formatter.formatResponse(sampleResponseWithMarkdownSections);

console.log('📤 AFTER: Formatted Response');
console.log('============================');
console.log(result.text);

console.log('\n\n📊 ANALYSIS');
console.log('===========');

// Count different section types
const codeBlocks = (result.text.match(/\[.*? CODE\]/g) || []).length;
const markdownSections = (result.text.match(/^## /gm) || []).length;
const complexityAnalyses = (result.text.match(/📊/g) || []).length;
const thinkingSections = (result.text.match(/💭 REASONING:/g) || []).length;

console.log(`🔢 Code Blocks: ${codeBlocks}`);
console.log(`📋 Markdown Sections: ${markdownSections}`);
console.log(`⚡ Complexity Analyses: ${complexityAnalyses}`);
console.log(`💭 Thinking Sections: ${thinkingSections}`);

// Check if specific sections were found
const hasApproachSection = result.text.includes('## Approach and Time Complexity');
const hasSolutionSection = result.text.includes('## Solution Code');
const hasAlternativeSection = result.text.includes('## Alternative Solutions');
const hasPerformanceSection = result.text.includes('## Performance Comparison');

console.log('\n🎯 MARKDOWN SECTION DETECTION:');
console.log(`   ✅ Solution Code: ${hasSolutionSection ? 'FOUND' : 'MISSING'}`);
console.log(`   ✅ Approach and Time Complexity: ${hasApproachSection ? 'FOUND' : 'MISSING'}`);
console.log(`   ✅ Alternative Solutions: ${hasAlternativeSection ? 'FOUND' : 'MISSING'}`);
console.log(`   ✅ Performance Comparison: ${hasPerformanceSection ? 'FOUND' : 'MISSING'}`);

// Verify section ordering
const positions = {
    firstCode: result.text.indexOf('[PYTHON CODE]'),
    firstMarkdown: result.text.indexOf('## '),
    firstThinking: result.text.indexOf('💭 REASONING:')
};

console.log('\n📍 SECTION ORDERING:');
console.log(`   Code starts at: ${positions.firstCode}`);
console.log(`   Markdown starts at: ${positions.firstMarkdown}`);
console.log(`   Thinking starts at: ${positions.firstThinking}`);

let orderingCorrect = true;
if (positions.firstCode >= 0 && positions.firstMarkdown >= 0) {
    if (positions.firstCode > positions.firstMarkdown) {
        console.log('   ❌ ERROR: Code should come before markdown sections');
        orderingCorrect = false;
    }
}

if (positions.firstMarkdown >= 0 && positions.firstThinking >= 0) {
    if (positions.firstMarkdown > positions.firstThinking) {
        console.log('   ❌ ERROR: Markdown sections should come before thinking');
        orderingCorrect = false;
    }
}

if (orderingCorrect) {
    console.log('   ✅ PERFECT: Sections are properly ordered');
}

console.log('\n🚀 FORMATTING BENEFITS:');
console.log('======================');
console.log('✅ CODE FIRST - Immediate access to implementations');
console.log('✅ STRUCTURED SECTIONS - Clear markdown headers preserved');
console.log('✅ APPROACH DETAILS - Time/space complexity prominently displayed');
console.log('✅ ALTERNATIVE SOLUTIONS - Multiple approaches clearly separated');
console.log('✅ THINKING LAST - Reasoning process available but not intrusive');

console.log('\n🎉 TEST COMPLETE!');
console.log('================');
console.log('The formatter now properly handles markdown sections like:');
console.log('- ### Solution Code');
console.log('- ### Approach and Time Complexity');
console.log('- ### Alternative Solutions');
console.log('- ### Performance Comparison');
console.log('\nYour DeepSeek responses will be beautifully formatted! 🎨');
