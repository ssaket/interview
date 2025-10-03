/**
 * Test markdown table detection in formatter.js
 */

const InterviewCodeFormatter = require('../src/js/formatter.js');

function runTests() {
  const formatter = new InterviewCodeFormatter();
  let passed = 0;
  let failed = 0;

  console.log('🧪 Testing Markdown Table Detection in Formatter\n');

  // Test 1: Detect simple table
  function test1() {
    const input = `| Name | Age |
|------|-----|
| Alice | 30 |`;

    const hasTables = formatter.hasMarkdownTables(input);

    if (hasTables) {
      console.log('✅ Test 1: Detect simple table - PASSED');
      passed++;
    } else {
      console.log('❌ Test 1: Detect simple table - FAILED');
      failed++;
    }
  }

  // Test 2: Wrap table in code block
  function test2() {
    const input = `Some text before

| Name | Age |
|------|-----|
| Alice | 30 |

Some text after`;

    const result = formatter.wrapTablesInCodeBlocks(input);

    if (result.includes('```markdown') && result.includes('```') && result.includes('Alice')) {
      console.log('✅ Test 2: Wrap table in code block - PASSED');
      passed++;
    } else {
      console.log('❌ Test 2: Wrap table in code block - FAILED');
      console.log('Result:', result);
      failed++;
    }
  }

  // Test 3: Extract multiple tables
  function test3() {
    const input = `| Table1 | Col |
|--------|-----|
| A | B |

Some text

| Table2 | Col |
|--------|-----|
| X | Y |`;

    const tables = formatter.extractMarkdownTables(input);

    if (tables.length === 2 && tables[0].content.includes('Table1') && tables[1].content.includes('Table2')) {
      console.log('✅ Test 3: Extract multiple tables - PASSED');
      passed++;
    } else {
      console.log('❌ Test 3: Extract multiple tables - FAILED');
      console.log('Tables found:', tables.length);
      failed++;
    }
  }

  // Test 4: System design table (realistic)
  function test4() {
    const input = `## Architecture

| Component | Responsibility | Protocol |
|-----------|----------------|----------|
| **API Gateway** | Request routing | HTTPS |
| **DB Cluster** | Data storage | SQL |`;

    const result = formatter.wrapTablesInCodeBlocks(input);

    if (result.includes('```markdown') && result.includes('API Gateway')) {
      console.log('✅ Test 4: System design table - PASSED');
      passed++;
    } else {
      console.log('❌ Test 4: System design table - FAILED');
      console.log('Result:', result);
      failed++;
    }
  }

  // Test 5: No tables present
  function test5() {
    const input = 'This is just regular text with no tables.';
    const hasTables = formatter.hasMarkdownTables(input);

    if (!hasTables) {
      console.log('✅ Test 5: No tables present - PASSED');
      passed++;
    } else {
      console.log('❌ Test 5: No tables present - FAILED');
      failed++;
    }
  }

  // Test 6: Integration with formatResponse
  function test6() {
    const input = `Here's a comparison:

| Algorithm | Time | Space |
|-----------|------|-------|
| BFS | O(V+E) | O(V) |
| DFS | O(V+E) | O(V) |

Both are linear time.`;

    const result = formatter.formatResponse(input, true, false);

    // The table should be wrapped in code blocks
    if (result.text.includes('```markdown') && result.text.includes('BFS')) {
      console.log('✅ Test 6: Integration with formatResponse - PASSED');
      passed++;
    } else {
      console.log('❌ Test 6: Integration with formatResponse - FAILED');
      console.log('Result:', result.text);
      failed++;
    }
  }

  // Test 7: Table position tracking
  function test7() {
    const input = `Start text

| Col1 | Col2 |
|------|------|
| A | B |

End text`;

    const tables = formatter.extractMarkdownTables(input);

    if (tables.length === 1 && tables[0].position > 0 && tables[0].content.includes('Col1')) {
      console.log('✅ Test 7: Table position tracking - PASSED');
      passed++;
    } else {
      console.log('❌ Test 7: Table position tracking - FAILED');
      console.log('Tables:', tables);
      failed++;
    }
  }

  // Run all tests
  test1();
  test2();
  test3();
  test4();
  test5();
  test6();
  test7();

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}/7`);
  console.log(`❌ Failed: ${failed}/7`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All table detection tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review.\n');
    process.exit(1);
  }
}

runTests();
