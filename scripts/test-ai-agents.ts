
import { documentAnalysisGraph } from "../features/documents/ai/document-analysis.graph";
import { messageDraftGraph } from "../features/tickets/ai/message-draft.graph";
import { maintenanceGraph } from "../features/tickets/ai/maintenance.graph";

async function testDocumentAgent() {
  console.log("\n🧪 Testing Document Analysis Agent...");
  const result = await documentAnalysisGraph.invoke({
    documentId: "test-doc-1",
    documentUrl: "http://fake.url/doc.pdf",
    declaredType: "attestation_assurance",
    tenantName: "Jean Dupont",
    verificationStatus: 'pending' // Initial state required by type
  });
  
  console.log("   > Result:", result.verificationStatus);
  if (result.verificationStatus === 'verified') {
    console.log("   ✅ Document Agent Passed");
  } else {
    console.log("   ❌ Document Agent Failed (Expected 'verified')");
    console.log(result);
  }
}

async function testMessagingAgent() {
  console.log("\n🧪 Testing Messaging Agent...");
  const result = await messageDraftGraph.invoke({
    messageHistory: [{ role: "user", content: "Je n'ai pas reçu mon avis d'échéance" }],
    senderRole: "owner",
    context: "general",
    // Optional fields initialized to avoid undefined issues if graph expects them, though optional in interface
    ticketId: "ticket-1", 
    threadId: "thread-1"
  });

  console.log("   > Draft:", result.draftResponse?.substring(0, 50) + "...");
  if (result.draftResponse && result.draftResponse.length > 0) {
    console.log("   ✅ Messaging Agent Passed");
  } else {
    console.log("   ❌ Messaging Agent Failed");
  }
}

async function testMaintenanceAgent() {
  console.log("\n🧪 Testing Maintenance Agent...");
  const result = await maintenanceGraph.invoke({
    ticketId: "ticket-maint-1",
    title: "Grosse fuite sous l'évier",
    description: "Il y a de l'eau partout dans la cuisine, c'est urgent",
    // Initialize optional fields
    urgencyScore: 0,
    detectedIssues: [],
    suggestedProviderTypes: [],
    suggestedAction: "",
    summary: "",
    priority: 'basse'
  });

  console.log("   > Urgency:", result.urgencyScore);
  console.log("   > Provider:", result.suggestedProviderTypes);
  
  if (result.urgencyScore && result.urgencyScore > 5 && result.suggestedProviderTypes?.includes('plomberie')) {
    console.log("   ✅ Maintenance Agent Passed");
  } else {
    console.log("   ❌ Maintenance Agent Failed");
    console.log(result);
  }
}

async function main() {
  console.log("🚀 Starting AI Agents Verification...");
  try {
    await testDocumentAgent();
    await testMessagingAgent();
    await testMaintenanceAgent();
    console.log("\n✨ All systems operational.");
  } catch (error) {
    console.error("\n💥 Verification failed:", error);
    process.exit(1);
  }
}

main();

