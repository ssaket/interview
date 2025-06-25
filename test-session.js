const { InferenceClient } = require("@huggingface/inference");
require("dotenv").config();

// Mock session management (similar to main.js)
let sessionHistory = [];
let sessionActive = false;

// Initialize HF client
const hfClient = new InferenceClient(process.env.HF_TOKEN);

// Session management functions
function resetSession() {
  sessionHistory = [];
  sessionActive = false;
  return { success: true, message: "Session reset successfully" };
}

function getSessionStatus() {
  return {
    active: sessionActive,
    messageCount: sessionHistory.length,
    exchangeCount: Math.floor(sessionHistory.length / 2),
  };
}

async function askWithSession(question) {
  try {
    // Build messages array with session history
    const messages = [
      {
        role: "system",
        content:
          "You are a coding interview tutor. Provide explanation, clean Python code, and time/space complexity. When answering follow-up questions, reference previous context appropriately.",
      },
      ...sessionHistory,
      { role: "user", content: question },
    ];

    const chatCompletion = await hfClient.chatCompletion({
      provider: process.env.HF_PROVIDER || "hyperbolic",
      model: process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
      messages: messages,
      stream: false,
    });

    const choice = chatCompletion.choices[0].message;
    const rawResponse =
      typeof choice === "string"
        ? choice
        : choice.content || JSON.stringify(choice);

    // Add to session history
    sessionHistory.push({ role: "user", content: question });
    sessionHistory.push({ role: "assistant", content: rawResponse });
    sessionActive = true;

    // Keep only last 10 exchanges (20 messages) to prevent context overflow
    if (sessionHistory.length > 20) {
      sessionHistory = sessionHistory.slice(-20);
    }

    return rawResponse;
  } catch (err) {
    console.error("Error:", err);
    return "Error occurred: " + (err.message || err);
  }
}

// Test session management
async function testSessionManagement() {
  console.log("🧪 Testing Session Management");
  console.log("=" .repeat(50));

  // Test 1: Initial session state
  console.log("\n1. Testing initial session state:");
  let status = getSessionStatus();
  console.log(`   Active: ${status.active}`);
  console.log(`   Message count: ${status.messageCount}`);
  console.log(`   Exchange count: ${status.exchangeCount}`);

  if (!status.active && status.messageCount === 0) {
    console.log("   ✅ Initial state correct");
  } else {
    console.log("   ❌ Initial state incorrect");
  }

  // Test 2: First question
  console.log("\n2. Testing first question:");
  const question1 = "What is a binary search algorithm?";
  console.log(`   Question: ${question1}`);
  const answer1 = await askWithSession(question1);
  console.log(`   Answer: ${answer1.substring(0, 100)}...`);

  status = getSessionStatus();
  console.log(`   Active: ${status.active}`);
  console.log(`   Exchange count: ${status.exchangeCount}`);

  if (status.active && status.exchangeCount === 1) {
    console.log("   ✅ Session activated correctly");
  } else {
    console.log("   ❌ Session not activated correctly");
  }

  // Test 3: Follow-up question
  console.log("\n3. Testing follow-up question:");
  const question2 = "Can you show me the Python implementation?";
  console.log(`   Question: ${question2}`);
  const answer2 = await askWithSession(question2);
  console.log(`   Answer: ${answer2.substring(0, 100)}...`);

  status = getSessionStatus();
  console.log(`   Exchange count: ${status.exchangeCount}`);

  if (status.exchangeCount === 2) {
    console.log("   ✅ Follow-up question handled correctly");
  } else {
    console.log("   ❌ Follow-up question not handled correctly");
  }

  // Test 4: Session reset
  console.log("\n4. Testing session reset:");
  const resetResult = resetSession();
  console.log(`   Reset result: ${resetResult.message}`);

  status = getSessionStatus();
  console.log(`   Active after reset: ${status.active}`);
  console.log(`   Message count after reset: ${status.messageCount}`);

  if (!status.active && status.messageCount === 0 && resetResult.success) {
    console.log("   ✅ Session reset correctly");
  } else {
    console.log("   ❌ Session reset failed");
  }

  // Test 5: New session after reset
  console.log("\n5. Testing new session after reset:");
  const question3 = "What is the time complexity of bubble sort?";
  console.log(`   Question: ${question3}`);
  const answer3 = await askWithSession(question3);
  console.log(`   Answer: ${answer3.substring(0, 100)}...`);

  status = getSessionStatus();
  console.log(`   Active: ${status.active}`);
  console.log(`   Exchange count: ${status.exchangeCount}`);

  if (status.active && status.exchangeCount === 1) {
    console.log("   ✅ New session started correctly after reset");
  } else {
    console.log("   ❌ New session not started correctly after reset");
  }

  console.log("\n" + "=" .repeat(50));
  console.log("🎉 Session management test completed!");
}

// Run the test
if (require.main === module) {
  testSessionManagement().catch(console.error);
}

module.exports = {
  askWithSession,
  resetSession,
  getSessionStatus,
  testSessionManagement,
};
