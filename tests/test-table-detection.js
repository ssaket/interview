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

  // Test 8: Column alignment - left, center, right
  function test8() {
    const input = `| Left | Center | Right |
|:-----|:------:|------:|
| A | B | C |
| Long text | X | Y |`;

    const formatted = formatter.formatTableASCII(input);

    // Check that columns are padded and aligned
    const lines = formatted.split('\n');
    const separatorLine = lines[1];

    // Check for alignment indicators:
    // - Left can be either '---' or ':---' (both valid)
    // - Center must be ':-*:' (dashes between two colons)
    // - Right must be '---:'
    const hasCenterAlign = separatorLine.match(/:-+:/); // Dashes between two colons
    const hasRightAlign = separatorLine.match(/[^:]-+:/); // Dashes ending with colon, not starting with colon
    const hasProperStructure = lines.length === 4;

    if (hasProperStructure && hasCenterAlign && hasRightAlign) {
      console.log('✅ Test 8: Column alignment (left/center/right) - PASSED');
      console.log('   Formatted table:');
      lines.forEach(line => console.log('   ' + line));
      passed++;
    } else {
      console.log('❌ Test 8: Column alignment - FAILED');
      console.log('Result:', formatted);
      console.log('Debug: hasProperStructure:', hasProperStructure, 'hasCenterAlign:', hasCenterAlign, 'hasRightAlign:', hasRightAlign);
      failed++;
    }
  }

  // Test 9: Varying cell widths
  function test9() {
    const input = `| A | B |
|---|---|
| Short | X |
| Very long content | Y |`;

    const formatted = formatter.formatTableASCII(input);
    const lines = formatted.split('\n');

    // Check that:
    // 1. Long content is preserved
    // 2. All rows have the same structure (3 pipe characters for 2 columns)
    // 3. First column is wider than second (due to "Very long content")
    const hasLongContent = formatted.includes('Very long content');
    const allRowsHaveSameStructure = lines.every(line => (line.match(/\|/g) || []).length === 3);

    // Extract column widths by checking the separator line
    const separatorMatch = lines[1].match(/\|\s*(-+)\s*\|\s*(-+)\s*\|/);
    const firstColWidth = separatorMatch ? separatorMatch[1].length : 0;
    const secondColWidth = separatorMatch ? separatorMatch[2].length : 0;
    const firstColWider = firstColWidth > secondColWidth;

    if (hasLongContent && allRowsHaveSameStructure && firstColWider) {
      console.log('✅ Test 9: Varying cell widths - PASSED');
      console.log('   Formatted table:');
      lines.forEach(line => console.log('   ' + line));
      passed++;
    } else {
      console.log('❌ Test 9: Varying cell widths - FAILED');
      console.log('Result:', formatted);
      console.log('Debug: hasLongContent:', hasLongContent, 'allRowsHaveSameStructure:', allRowsHaveSameStructure, 'firstColWider:', firstColWider);
      failed++;
    }
  }

  // Test 10: Table with markdown formatting in cells
  function test10() {
    const input = `| Header | Value |
|--------|-------|
| **Bold** | Normal |
| *Italic* | \`code\` |`;

    const formatted = formatter.formatTableASCII(input);

    // Check that markdown formatting is preserved
    if (formatted.includes('**Bold**') && formatted.includes('*Italic*') && formatted.includes('`code`')) {
      console.log('✅ Test 10: Markdown formatting in cells - PASSED');
      passed++;
    } else {
      console.log('❌ Test 10: Markdown formatting in cells - FAILED');
      console.log('Result:', formatted);
      failed++;
    }
  }

  // Test 11: HTML table generation
  function test11() {
    const input = `| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |`;

    const html = formatter.formatTableHTML(input);

    // Check that HTML table is generated with proper structure
    const hasTableTag = html.includes('<table class="markdown-table">');
    const hasThead = html.includes('<thead>') && html.includes('</thead>');
    const hasTbody = html.includes('<tbody>') && html.includes('</tbody>');
    const hasContent = html.includes('Alice') && html.includes('30');

    if (hasTableTag && hasThead && hasTbody && hasContent) {
      console.log('✅ Test 11: HTML table generation - PASSED');
      passed++;
    } else {
      console.log('❌ Test 11: HTML table generation - FAILED');
      console.log('Result:', html);
      failed++;
    }
  }

  // Test 12: HTML table with alignment
  function test12() {
    const input = `| Left | Center | Right |
|:-----|:------:|------:|
| A | B | C |`;

    const html = formatter.formatTableHTML(input);

    // Check that alignment is applied in HTML
    const hasLeftAlign = html.includes('text-align: left');
    const hasCenterAlign = html.includes('text-align: center');
    const hasRightAlign = html.includes('text-align: right');

    if (hasLeftAlign && hasCenterAlign && hasRightAlign) {
      console.log('✅ Test 12: HTML table with alignment - PASSED');
      passed++;
    } else {
      console.log('❌ Test 12: HTML table with alignment - FAILED');
      console.log('Result:', html);
      failed++;
    }
  }

  // Test 13: Empty cells
  function test13() {
    const input = `| Col1 | Col2 |
|------|------|
| A |  |
|  | B |`;

    const formatted = formatter.formatTableASCII(input);

    // Should handle empty cells without breaking
    if (formatted.includes('|') && formatted.split('\n').length === 4) {
      console.log('✅ Test 13: Empty cells - PASSED');
      passed++;
    } else {
      console.log('❌ Test 13: Empty cells - FAILED');
      console.log('Result:', formatted);
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
  test8();
  test9();
  test10();
  test11();
  test12();
  test13();

  // Summary
  const totalTests = 13;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}/${totalTests}`);
  console.log(`❌ Failed: ${failed}/${totalTests}`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All table detection and formatting tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review.\n');
    process.exit(1);
  }
}

runTests();
