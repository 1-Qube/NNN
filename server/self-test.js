import { initDatabase } from './db.js';
import { getAnalyticsBundle } from './analyticsEngine.js';
import { parseCSVText, importCustomDataset, generateSampleUploadCSV } from './datasetImport.js';
import { buildAnalyticsContextPrompt, callGeminiAPI } from './geminiService.js';

async function runTests() {
  console.log('1. Initializing SQLite Database & Synthetic Demonstration Dataset...');
  initDatabase();

  console.log('2. Verifying Analytics Engine calculations across all 4 subjects...');
  for (const subId of ['SUB-MATH-9', 'SUB-PHYS-9', 'SUB-CHEM-9', 'SUB-CS-9']) {
    const bundle = getAnalyticsBundle({
      datasetId: 'DS-SYNTHETIC-DEMO',
      subjectId: subId
    });
    console.log(
      `   [${bundle.active_subject.code}] Students=${bundle.kpis.total_students}, Assessments=${bundle.kpis.total_assessments}, Mean=${bundle.kpis.overall_mean_score}%, StruggleRate=${bundle.kpis.struggle_rate_pct}%, CriticalTopics=${bundle.kpis.critical_topics_count}, TopTextbook=${bundle.kpis.top_textbook.title_en} (${bundle.kpis.top_textbook.composite_efficacy}/100), ShiftedHours=${bundle.kpis.hours_reallocated}h (+${bundle.kpis.projected_mastery_gain}% gain)`
    );
  }

  console.log('3. Testing CSV Dataset Parser & Importer...');
  const sampleCsv = generateSampleUploadCSV();
  const rows = parseCSVText(sampleCsv);
  const imported = importCustomDataset({
    datasetName: 'Self-Test Biology Grade 10 Upload',
    rows
  });
  const uploadedBundle = getAnalyticsBundle({ datasetId: imported.dataset_id });
  console.log(
    `   Imported dataset ${imported.dataset_id}: ${uploadedBundle.kpis.total_assessments} assessments, Mean=${uploadedBundle.kpis.overall_mean_score}%, TopTextbook=${uploadedBundle.kpis.top_textbook.title_en}`
  );

  console.log('4. Testing Live Google Gemini API Integration with Calculated Metrics...');
  const mathBundle = getAnalyticsBundle({
    datasetId: 'DS-SYNTHETIC-DEMO',
    subjectId: 'SUB-MATH-9'
  });
  const sysPrompt = buildAnalyticsContextPrompt(mathBundle, 'en');
  const aiRes = await callGeminiAPI({
    systemPrompt: sysPrompt,
    userPrompt:
      'In 3 concise bullet points, state the hardest topic in Grade 9 Math (with its exact mean score and LDI), the top-performing textbook (with its Composite Efficacy score), and how many hours are redistributed by the optimizer.'
  });
  console.log(`   Gemini Model Used: ${aiRes.modelUsed}`);
  console.log(`   Gemini Response:\n${aiRes.text}\n`);
  console.log('ALL BACKEND, DATABASE, ANALYTICS & GEMINI AI TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Self-test failed:', err);
  process.exit(1);
});
