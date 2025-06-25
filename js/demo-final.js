const DeepSeekFormatter = require('./formatter');

console.log('🎯 FINAL DEMO: DeepSeek Response Reordering');
console.log('===========================================\n');

// Sample DeepSeek response exactly as it would come from the API
const originalDeepSeekResponse = `<think>
This is a classic dynamic programming problem. The user wants to solve the "Climbing Stairs" problem.

Let me think about this:
1. You can climb either 1 or 2 steps at a time
2. Need to find total ways to reach the top
3. This is essentially a Fibonacci sequence!

At each step n, you can reach it from:
- Step n-1 (by taking 1 step)
- Step n-2 (by taking 2 steps)

So ways(n) = ways(n-1) + ways(n-2)

Base cases: ways(1) = 1, ways(2) = 2

I should provide both recursive and iterative solutions.
</think>

Looking at this climbing stairs problem, I need to find the number of distinct ways to climb n stairs.

<think>
Actually, let me be more precise about the approach:

1. Recursive approach (with memoization)
2. Iterative approach (bottom-up DP)
3. Space-optimized approach

The recursive approach is easier to understand but has exponential time without memoization.
The iterative approach is more efficient.
</think>

## Recursive Solution (with Memoization)

\`\`\`python
def climbStairs(n: int) -> int:
    memo = {}

    def dp(n):
        if n in memo:
            return memo[n]

        if n <= 2:
            return n

        memo[n] = dp(n-1) + dp(n-2)
        return memo[n]

    return dp(n)
\`\`\`

<think>
The recursive solution is clear but uses O(n) space for both memoization and call stack.

Let me provide the iterative version which is more space-efficient.
</think>

## Iterative Solution (Bottom-up DP)

\`\`\`python
def climbStairs(n: int) -> int:
    if n <= 2:
        return n

    dp = [0] * (n + 1)
    dp[1] = 1
    dp[2] = 2

    for i in range(3, n + 1):
        dp[i] = dp[i-1] + dp[i-2]

    return dp[n]
\`\`\`

## Optimized Solution (Constant Space)

\`\`\`python
def climbStairs(n: int) -> int:
    if n <= 2:
        return n

    prev2, prev1 = 1, 2

    for i in range(3, n + 1):
        current = prev1 + prev2
        prev2 = prev1
        prev1 = current

    return prev1
\`\`\`

<think>
Perfect! I've provided three solutions:
1. Recursive with memoization - O(n) time, O(n) space
2. Iterative DP - O(n) time, O(n) space
3. Space-optimized - O(n) time, O(1) space

The space-optimized version is the best since we only need the last two values to compute the current value.
</think>

## How it Works

The key insight is that this follows the Fibonacci pattern:
- To reach step n, you can come from step n-1 (take 1 step) or step n-2 (take 2 steps)
- So the total ways = ways(n-1) + ways(n-2)

**Example for n=5:**
- Step 1: 1 way
- Step 2: 2 ways
- Step 3: 3 ways (1+2)
- Step 4: 5 ways (2+3)
- Step 5: 8 ways (3+5)

## Complexity Analysis

**Recursive (with memoization):**
Time Complexity: O(n) - each subproblem computed once
Space Complexity: O(n) - memoization table + recursion stack

**Iterative DP:**
Time Complexity: O(n) - single loop through all steps
Space Complexity: O(n) - DP array

**Space-Optimized:**
Time Complexity: O(n) - single loop
Space Complexity: O(1) - only storing previous two values

The space-optimized solution is preferred for large n values due to its constant space usage.`;

console.log('📥 BEFORE: Original DeepSeek Response');
console.log('=====================================');
console.log('Notice how thinking sections are mixed throughout the response:\n');
console.log(originalDeepSeekResponse);

console.log('\n\n' + '='.repeat(80) + '\n');

// Format the response
const formatter = new DeepSeekFormatter();
const result = formatter.formatResponse(originalDeepSeekResponse);

console.log('📤 AFTER: Formatted & Reordered Response');
console.log('========================================');
console.log('Code first, complexity second, thinking last:\n');
console.log(result.text);

console.log('\n\n📊 TRANSFORMATION ANALYSIS');
console.log('===========================');

// Analyze the changes
const originalLength = originalDeepSeekResponse.length;
const formattedLength = result.text.length;
const compression = ((1 - formattedLength / originalLength) * 100).toFixed(1);

console.log(`📏 Length: ${originalLength} → ${formattedLength} chars (${compression}% compression)`);
console.log(`📝 Has Code: ${result.hasCode ? 'YES' : 'NO'}`);

// Count sections
const codeBlocks = (result.text.match(/\[.*? CODE\]/g) || []).length;
const complexityAnalyses = (result.text.match(/📊/g) || []).length;
const thinkingSections = (result.text.match(/💭 REASONING:/g) || []).length;

console.log(`🔢 Code Blocks: ${codeBlocks}`);
console.log(`⚡ Complexity Analyses: ${complexityAnalyses}`);
console.log(`💭 Thinking Sections: ${thinkingSections}`);

// Verify ordering
const firstCodePos = result.text.indexOf('[PYTHON CODE]');
const firstThinkingPos = result.text.indexOf('💭 REASONING:');

console.log(`\n🎯 SECTION ORDERING VERIFICATION:`);
console.log(`   Code starts at position: ${firstCodePos}`);
console.log(`   Thinking starts at position: ${firstThinkingPos}`);

if (firstCodePos >= 0 && firstThinkingPos > firstCodePos) {
    console.log('   ✅ PERFECT! Code appears before thinking sections');
} else {
    console.log('   ❌ Ordering needs adjustment');
}

console.log('\n🚀 KEY BENEFITS FOR CODING INTERVIEWS:');
console.log('======================================');
console.log('✅ IMMEDIATE CODE VISIBILITY - See solutions instantly');
console.log('✅ MULTIPLE APPROACHES - Compare different implementations');
console.log('✅ COMPLEXITY UPFRONT - Understand performance implications');
console.log('✅ CLEAN EXPLANATIONS - Context without verbose fluff');
console.log('✅ THINKING AT END - Deep reasoning when you need it');
console.log('✅ COPY-FRIENDLY - Easy to extract and test code');

console.log('\n🎉 READY FOR DEEPSEEK CODING INTERVIEWS!');
console.log('Your overlay app now shows code first, thinking last.');
console.log('Perfect for rapid problem-solving and code review!');
