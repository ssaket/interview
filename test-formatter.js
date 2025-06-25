const ResponseFormatter = require('./formatter');

// Test cases for the response formatter
const testCases = [
  {
    name: "Verbose Python Solution",
    input: `Let me help you solve this step by step! I'll provide a clean Python solution.

Here's how you can implement a binary search algorithm:

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

# Example usage
arr = [1, 3, 5, 7, 9, 11, 13]
target = 7
result = binary_search(arr, target)
print(f"Target found at index: {result}")
\`\`\`

As you can see, this implementation is quite efficient.

Time Complexity: O(log n)
Space Complexity: O(1)

I hope this helps! Let me know if you need any clarification.`
  },

  {
    name: "JavaScript with Multiple Sections",
    input: `Sure! I can help you implement a debounce function.

## Debounce Implementation

\`\`\`javascript
function debounce(func, delay) {
    let timeoutId;

    return function(...args) {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Usage example
const debouncedSearch = debounce((query) => {
    console.log('Searching for:', query);
    // Perform search operation
}, 300);
\`\`\`

## Key Points

- The function returns a new function that delays execution
- Each call resets the timer
- Uses \`apply\` to maintain proper \`this\` context

Time Complexity: O(1) per call
Space Complexity: O(1)`
  },

  {
    name: "Simple Code Snippet",
    input: `\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\`

Time Complexity: O(2^n)
Space Complexity: O(n) due to recursion stack`
  },

  {
    name: "Text with Inline Code",
    input: `To reverse a string in Python, you can use slicing with \`string[::-1]\` or the \`reversed()\` function. The **slicing method** is more efficient for strings.

For lists, use \`list.reverse()\` to modify in-place or \`reversed(list)\` to get an iterator.`
  },

  {
    name: "Complex Algorithm Explanation",
    input: `I'll help you implement Dijkstra's algorithm step by step.

## Algorithm Overview

Dijkstra's algorithm finds the shortest path from a source vertex to all other vertices in a weighted graph.

\`\`\`python
import heapq
from collections import defaultdict

def dijkstra(graph, start):
    # Initialize distances
    distances = defaultdict(lambda: float('inf'))
    distances[start] = 0

    # Priority queue: (distance, vertex)
    pq = [(0, start)]
    visited = set()

    while pq:
        current_dist, current = heapq.heappop(pq)

        if current in visited:
            continue

        visited.add(current)

        # Check neighbors
        for neighbor, weight in graph[current]:
            distance = current_dist + weight

            if distance < distances[neighbor]:
                distances[neighbor] = distance
                heapq.heappush(pq, (distance, neighbor))

    return dict(distances)

# Example usage
graph = {
    'A': [('B', 4), ('C', 2)],
    'B': [('C', 1), ('D', 5)],
    'C': [('D', 8), ('E', 10)],
    'D': [('E', 2)],
    'E': []
}

result = dijkstra(graph, 'A')
print("Shortest distances:", result)
\`\`\`

## Complexity Analysis

Time Complexity: O((V + E) log V) where V is vertices and E is edges
Space Complexity: O(V) for the distance array and priority queue

The algorithm uses a **min-heap** to always process the vertex with the smallest known distance first.`
  }
];

function runTests() {
  const formatter = new ResponseFormatter();

  console.log('🧪 Response Formatter Test Suite\n');
  console.log('=' .repeat(60));

  testCases.forEach((testCase, index) => {
    console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
    console.log('-'.repeat(40));

    console.log('\n📥 INPUT:');
    console.log(testCase.input.substring(0, 200) + (testCase.input.length > 200 ? '...' : ''));

    const result = formatter.formatResponse(testCase.input);

    console.log('\n📤 FORMATTED TEXT OUTPUT:');
    console.log(result.text.substring(0, 300) + (result.text.length > 300 ? '...' : ''));

    console.log('\n📊 ANALYSIS:');
    console.log(`- Has Code: ${result.hasCode ? '✅' : '❌'}`);
    console.log(`- Original Length: ${testCase.input.length} chars`);
    console.log(`- Formatted Length: ${result.text.length} chars`);
    console.log(`- Compression: ${((1 - result.text.length / testCase.input.length) * 100).toFixed(1)}%`);

    console.log('\n' + '='.repeat(60));
  });
}

// Function to test with a specific input
function testSingleResponse(input) {
  const formatter = new ResponseFormatter();
  const result = formatter.formatResponse(input);

  console.log('\n🔍 Single Response Test');
  console.log('=' .repeat(40));
  console.log('\n📥 INPUT:');
  console.log(input);
  console.log('\n📤 FORMATTED:');
  console.log(result.text);
  console.log('\n📋 HTML:');
  console.log(result.html);
  console.log('\n📊 Has Code:', result.hasCode);

  return result;
}

// Export functions for use in other files
module.exports = {
  runTests,
  testSingleResponse,
  testCases
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();

  // Test with a simple example
  console.log('\n\n🎯 Quick Test Example:');
  testSingleResponse(`Here's a simple function:

\`\`\`python
def add(a, b):
    return a + b
\`\`\`

Time Complexity: O(1)`);
}
