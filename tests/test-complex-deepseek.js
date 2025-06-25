const DeepSeekFormatter = require("../js/formatter");

console.log("🧠 Complex DeepSeek Response Reordering Test");
console.log("============================================\n");

// Complex DeepSeek response with multiple sections
const complexResponse = `<think>
This is an interesting problem about implementing a LRU (Least Recently Used) cache. Let me think about the requirements:

1. Need O(1) get and put operations
2. Need to track usage order
3. Need to evict least recently used when capacity is exceeded

I think I'll need:
- Hash map for O(1) access
- Doubly linked list for O(1) insertion/deletion
- Keep track of head and tail nodes

Let me design this step by step.
</think>

Here's how to implement an efficient LRU Cache with O(1) operations.

## Approach

We'll use a combination of hash map and doubly linked list to achieve O(1) time complexity for both get and put operations.

<think>
Actually, let me think about the data structure more carefully:

1. Hash map: key -> node (for O(1) access)
2. Doubly linked list: for maintaining order
3. Head: most recently used
4. Tail: least recently used

For get(key):
- If key exists, move node to head
- Return value

For put(key, value):
- If key exists, update value and move to head
- If key doesn't exist, create new node at head
- If capacity exceeded, remove tail node

This should work efficiently.
</think>

## Implementation

### Node Structure

\`\`\`python
class Node:
    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None
\`\`\`

### LRU Cache Class

\`\`\`python
class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}  # key -> node

        # Create dummy head and tail nodes
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _add_node(self, node):
        """Add node right after head"""
        node.prev = self.head
        node.next = self.head.next

        self.head.next.prev = node
        self.head.next = node

    def _remove_node(self, node):
        """Remove an existing node from the linked list"""
        prev_node = node.prev
        next_node = node.next

        prev_node.next = next_node
        next_node.prev = prev_node

    def _move_to_head(self, node):
        """Move node to head (mark as recently used)"""
        self._remove_node(node)
        self._add_node(node)

    def _pop_tail(self):
        """Pop the current tail (least recently used)"""
        last_node = self.tail.prev
        self._remove_node(last_node)
        return last_node

    def get(self, key: int) -> int:
        node = self.cache.get(key)

        if node:
            # Move to head (mark as recently used)
            self._move_to_head(node)
            return node.value

        return -1

    def put(self, key: int, value: int) -> None:
        node = self.cache.get(key)

        if node:
            # Update existing node
            node.value = value
            self._move_to_head(node)
        else:
            # Create new node
            new_node = Node(key, value)

            if len(self.cache) >= self.capacity:
                # Remove least recently used
                tail = self._pop_tail()
                del self.cache[tail.key]

            # Add new node
            self.cache[key] = new_node
            self._add_node(new_node)
\`\`\`

<think>
Let me verify this implementation:

1. get(key):
   - Hash map lookup: O(1)
   - Move to head: O(1)
   - Total: O(1) ✓

2. put(key, value):
   - Hash map lookup: O(1)
   - Update/create node: O(1)
   - Move to head or add: O(1)
   - Remove tail if needed: O(1)
   - Total: O(1) ✓

The doubly linked list allows O(1) insertion/deletion because we maintain references to prev/next nodes.

The hash map gives us O(1) access to any node.

This looks correct!
</think>

### Usage Example

\`\`\`python
# Example usage
lru = LRUCache(2)

lru.put(1, 1)  # cache: {1=1}
lru.put(2, 2)  # cache: {1=1, 2=2}
print(lru.get(1))  # returns 1, cache: {2=2, 1=1}

lru.put(3, 3)  # evicts key 2, cache: {1=1, 3=3}
print(lru.get(2))  # returns -1 (not found)
print(lru.get(3))  # returns 3, cache: {1=1, 3=3}
print(lru.get(1))  # returns 1, cache: {3=3, 1=1}

lru.put(4, 4)  # evicts key 3, cache: {1=1, 4=4}
print(lru.get(3))  # returns -1 (not found)
print(lru.get(4))  # returns 4
\`\`\`

## Alternative Implementation (JavaScript)

\`\`\`javascript
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    get(key) {
        if (this.cache.has(key)) {
            // Move to end (most recent)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        return -1;
    }

    put(key, value) {
        if (this.cache.has(key)) {
            // Update and move to end
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            // Remove oldest (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, value);
    }
}
\`\`\`

## Key Design Decisions

**Data Structure Choice:**
- Hash map provides O(1) key lookup
- Doubly linked list enables O(1) insertion/deletion at any position
- Dummy head/tail nodes simplify edge case handling

**Node Management:**
- Always add new/accessed nodes after head (most recent)
- Remove from tail when capacity exceeded (least recent)
- Maintain both forward and backward pointers for efficient removal

**Memory Optimization:**
- Only store necessary data in nodes (key, value, pointers)
- Use dummy nodes to avoid null pointer checks
- Clean up hash map entries when nodes are removed

## Complexity Analysis

**Time Complexity:**
- get(key): O(1) - hash lookup + linked list operations
- put(key, value): O(1) - hash operations + linked list operations

**Space Complexity:**
- O(capacity) - hash map and linked list both store at most 'capacity' elements

The combination of hash map and doubly linked list is the key to achieving O(1) performance for both operations while maintaining the LRU ordering.

<think>
This is a comprehensive implementation. Let me double-check the key points:

1. ✓ O(1) get and put operations
2. ✓ Proper LRU eviction policy
3. ✓ Clean separation of concerns (hash map for access, linked list for ordering)
4. ✓ Dummy nodes to simplify implementation
5. ✓ Both Python and JavaScript implementations
6. ✓ Clear complexity analysis

I think this covers all the important aspects of LRU cache implementation. The user should be able to understand both the approach and the implementation details.
</think>`;

// Test the formatter
const formatter = new DeepSeekFormatter();

console.log("📥 ORIGINAL Complex DeepSeek Response:");
console.log("─".repeat(60));
console.log("Length:", complexResponse.length, "characters");
console.log("Preview:", complexResponse.substring(0, 200) + "...\n");

console.log("📤 FORMATTED Response (Reordered):");
console.log("─".repeat(60));

const result = formatter.formatResponse(complexResponse);

console.log(result.text);

console.log("\n📊 DETAILED ANALYSIS:");
console.log("─".repeat(30));
console.log(`✅ Original length: ${complexResponse.length} characters`);
console.log(`✅ Formatted length: ${result.text.length} characters`);
console.log(`✅ Has code: ${result.hasCode ? "YES" : "NO"}`);
console.log(
  `✅ Compression: ${((1 - result.text.length / complexResponse.length) * 100).toFixed(1)}%`,
);

// Count sections
const sections = {
  codeBlocks: (result.text.match(/\[.*? CODE\]/g) || []).length,
  complexity: (result.text.match(/📊/g) || []).length,
  thinking: (result.text.match(/💭 REASONING:/g) || []).length,
};

console.log(`✅ Code blocks found: ${sections.codeBlocks}`);
console.log(`✅ Complexity analyses: ${sections.complexity}`);
console.log(`✅ Thinking sections: ${sections.thinking}`);

console.log("\n🎯 REORDERING VERIFICATION:");
console.log("─".repeat(35));

// Find positions of different content types
const codePos = result.text.indexOf("[PYTHON CODE]");
const complexityPos = result.text.indexOf("📊");
const thinkingPos = result.text.indexOf("💭 REASONING:");

console.log(`✅ First code block appears at position: ${codePos}`);
console.log(`✅ First complexity analysis at position: ${complexityPos}`);
console.log(`✅ First thinking section at position: ${thinkingPos}`);

if (codePos < complexityPos && complexityPos < thinkingPos) {
  console.log("🎉 PERFECT! Order is: Code → Complexity → Thinking");
} else {
  console.log("⚠️  Order might need adjustment");
}

console.log("\n🚀 BENEFITS FOR CODING INTERVIEWS:");
console.log("─".repeat(40));
console.log("• SEE THE CODE IMMEDIATELY - no scrolling needed");
console.log("• COMPLEXITY highlighted upfront - know the performance");
console.log("• EXPLANATIONS provide context after seeing the solution");
console.log("• THINKING PROCESS at the end - understand the reasoning");
console.log("• MULTIPLE LANGUAGES supported (Python + JavaScript)");
console.log("• CLEAN FORMATTING makes it easy to copy/paste code");

console.log("\n✨ Ready for your DeepSeek coding assistant!");
