import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDatabase, db, seedDemoDataset } from './db.js';
import { getAnalyticsBundle, getDatasetsList } from './analyticsEngine.js';
import {
  parseCSVText,
  importCustomDataset,
  generateSampleUploadCSV
} from './datasetImport.js';
import {
  getGeminiStatus,
  buildAnalyticsContextPrompt,
  callGeminiAPI,
  logAiInsight
} from './geminiService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

initDatabase();

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// 1. Health & System Status
app.get('/api/health', (req, res) => {
  try {
    const datasets = getDatasetsList();
    const totalAssessments = db
      .prepare('SELECT COUNT(*) as count FROM assessments')
      .get().count;
    res.json({
      status: 'ok',
      engine: 'CurricuLab Psychometric & Optimization Engine v1.0',
      database: 'SQLite3 (WAL Mode)',
      total_datasets: datasets.length,
      total_assessments: totalAssessments,
      gemini: getGeminiStatus()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Main Calculated Analytics Bundle
app.get('/api/analytics', (req, res) => {
  try {
    const {
      datasetId = 'DS-SYNTHETIC-DEMO',
      subjectId = null,
      classId = 'ALL',
      textbookId = 'ALL',
      strategy = 'balanced',
      maxChangePct = 35,
      budgetDeltaHours = 0
    } = req.query;

    const bundle = getAnalyticsBundle({
      datasetId,
      subjectId,
      classId,
      textbookId,
      optimizationParams: {
        strategy,
        maxChangePct: Number(maxChangePct),
        budgetDeltaHours: Number(budgetDeltaHours)
      }
    });

    res.json(bundle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Apply or Customize Teaching-Hour Allocations
app.post('/api/optimization/apply', (req, res) => {
  try {
    const { datasetId = 'DS-SYNTHETIC-DEMO', subjectId, allocations = [] } = req.body;
    if (!subjectId || !Array.isArray(allocations)) {
      return res.status(400).json({ error: 'subjectId and allocations array are required.' });
    }

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO curriculum_hour_overrides (dataset_id, subject_id, topic_id, allocated_hours, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(dataset_id, subject_id, topic_id)
      DO UPDATE SET allocated_hours = excluded.allocated_hours, updated_at = excluded.updated_at
    `);

    db.exec('BEGIN TRANSACTION');
    for (const item of allocations) {
      upsert.run(datasetId, subjectId, item.topic_id, Number(item.allocated_hours), now);
    }
    db.exec('COMMIT');

    const updated = getAnalyticsBundle({ datasetId, subjectId });
    res.json({
      success: true,
      message: 'Curriculum teaching-hour allocations saved to database.',
      bundle: updated
    });
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/optimization/reset', (req, res) => {
  try {
    const { datasetId = 'DS-SYNTHETIC-DEMO', subjectId } = req.body;
    db.prepare(
      'DELETE FROM curriculum_hour_overrides WHERE dataset_id = ? AND subject_id = ?'
    ).run(datasetId, subjectId);

    const updated = getAnalyticsBundle({ datasetId, subjectId });
    res.json({
      success: true,
      bundle: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Dataset Upload, Sample CSV & Reset
app.get('/api/datasets/sample-csv', (req, res) => {
  const csv = generateSampleUploadCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="grade10_biology_assessment_sample.csv"'
  );
  res.send(csv);
});

app.post('/api/datasets/upload', (req, res) => {
  try {
    const { datasetName, csvText, rows, notes } = req.body;
    let parsedRows = rows;
    if (!parsedRows && typeof csvText === 'string') {
      parsedRows = parseCSVText(csvText);
    }
    if (!Array.isArray(parsedRows) || !parsedRows.length) {
      return res
        .status(400)
        .json({ error: 'Please provide non-empty CSV text or JSON assessment rows.' });
    }

    const result = importCustomDataset({
      datasetName: datasetName || `Uploaded Dataset (${new Date().toLocaleTimeString()})`,
      rows: parsedRows,
      notes: notes || 'Empirical student assessment dataset uploaded by methodologist'
    });

    const bundle = getAnalyticsBundle({ datasetId: result.dataset_id });
    res.json({
      success: true,
      import_summary: result,
      bundle
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/datasets/load-sample-biology', (req, res) => {
  try {
    const csvText = generateSampleUploadCSV();
    const rows = parseCSVText(csvText);
    const result = importCustomDataset({
      datasetName: 'Grade 10 Molecular Biology Benchmark (Uploaded CSV Sample)',
      rows,
      notes: 'Imported from Grade 10 Biology 120-assessment multi-textbook cohort CSV.'
    });
    const bundle = getAnalyticsBundle({ datasetId: result.dataset_id });
    res.json({
      success: true,
      import_summary: result,
      bundle
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/datasets/reset-demo', (req, res) => {
  try {
    seedDemoDataset();
    const bundle = getAnalyticsBundle({ datasetId: 'DS-SYNTHETIC-DEMO' });
    res.json({
      success: true,
      bundle
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Gemini AI Methodologist Assistant & Contextual Deep-Dive Analysis
app.post('/api/ai/chat', async (req, res) => {
  try {
    const {
      datasetId = 'DS-SYNTHETIC-DEMO',
      subjectId = null,
      classId = 'ALL',
      textbookId = 'ALL',
      strategy = 'balanced',
      maxChangePct = 35,
      budgetDeltaHours = 0,
      message = '',
      history = [],
      lang = 'en'
    } = req.body;

    if (!message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const bundle = getAnalyticsBundle({
      datasetId,
      subjectId,
      classId,
      textbookId,
      optimizationParams: {
        strategy,
        maxChangePct: Number(maxChangePct),
        budgetDeltaHours: Number(budgetDeltaHours)
      }
    });

    const systemPrompt = buildAnalyticsContextPrompt(bundle, lang);
    const { text, modelUsed } = await callGeminiAPI({
      systemPrompt,
      userPrompt: message,
      history
    });

    logAiInsight({
      datasetId: bundle.active_dataset.id,
      subjectId: bundle.active_subject.id,
      mode: 'chat',
      promptSummary: message,
      responseMarkdown: text,
      modelUsed
    });

    res.json({
      reply: text,
      modelUsed,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: `Gemini AI Error: ${err.message}`
    });
  }
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const {
      datasetId = 'DS-SYNTHETIC-DEMO',
      subjectId = null,
      classId = 'ALL',
      textbookId = 'ALL',
      strategy = 'balanced',
      maxChangePct = 35,
      budgetDeltaHours = 0,
      analysisType = 'executive_summary',
      targetTopicCode = null,
      lang = 'en'
    } = req.body;

    const bundle = getAnalyticsBundle({
      datasetId,
      subjectId,
      classId,
      textbookId,
      optimizationParams: {
        strategy,
        maxChangePct: Number(maxChangePct),
        budgetDeltaHours: Number(budgetDeltaHours)
      }
    });

    const systemPrompt = buildAnalyticsContextPrompt(bundle, lang);
    let userPrompt = '';

    if (analysisType === 'topic_diagnosis') {
      const topic =
        bundle.topic_analytics.find((t) => t.code === targetTopicCode) ||
        bundle.topic_analytics.sort((a, b) => b.difficulty_index - a.difficulty_index)[0];
      userPrompt =
        lang === 'ru'
          ? `Проведи глубокую методическую диагностику темы [${topic.code}] «${topic.title_ru}» (Средний балл: ${topic.mean_score}%, Индекс трудности LDI: ${topic.difficulty_index}, Доля не справившихся: ${topic.struggle_rate}%, Узкое место: ${topic.primary_bottleneck_ru}, Типичная ошибка: ${topic.common_error_ru}).
1. Объясни когнитивные причины низкого усвоения и расхождения между концептуальным (${topic.conceptual_avg}%), процедурным (${topic.procedural_avg}%) и прикладным (${topic.applied_avg}%) уровнями.
2. Сравни результаты по учебникам для этой темы и укажи, какой учебник дает лучший результат и почему.
3. Предложи конкретный поурочный план коррекции (как именно использовать рекомендуемые дополнительные часы).`
          : `Conduct a deep methodological diagnosis of topic [${topic.code}] "${topic.title_en}" (Mean Score: ${topic.mean_score}%, LDI: ${topic.difficulty_index}, Struggle Rate: ${topic.struggle_rate}%, Primary Bottleneck: ${topic.primary_bottleneck_en}, Common Error: "${topic.common_error_en}").
1. Explain the root cognitive causes of the learning gap and the divergence between Conceptual (${topic.conceptual_avg}%), Procedural (${topic.procedural_avg}%), and Applied (${topic.applied_avg}%) mastery.
2. Compare how the different textbooks perform specifically on [${topic.code}] and identify which textbook's pedagogical scaffolding works best.
3. Provide a concrete 3-step instructional remediation protocol for methodologists and teachers.`;
    } else if (analysisType === 'textbook_comparison') {
      userPrompt =
        lang === 'ru'
          ? `Сравни эффективность всех учебников по предмету «${bundle.active_subject.name_ru}» на основе рассчитанных показателей (Composite Efficacy, Aptitude-Controlled Score, Value-Added Delta, Cohen's d и результатов по сложным темам).
1. Какой учебник является лидером по добавленной образовательной ценности (с учетом поправки на исходный уровень классов)?
2. По каким именно темам каждый учебник показывает сильные и слабые стороны?
3. Дай практическую рекомендацию методическому совету: какой учебник выбрать базовым, а какой использовать как дополнительный практикум по западающим разделам.`
          : `Compare all evaluated textbooks for "${bundle.active_subject.name_en}" using the calculated metrics (Composite Efficacy, Aptitude-Controlled Score, Value-Added Delta, Cohen's d, and performance on high-difficulty topics).
1. Which textbook delivers the highest true value-added learning gain after controlling for student baseline aptitude?
2. Break down topic-specific strengths and weaknesses (where should a hybrid curriculum use supplementary chapters from another publisher?).
3. Provide a formal textbook adoption & procurement recommendation for the regional curriculum board.`;
    } else if (analysisType === 'optimization_memo') {
      userPrompt =
        lang === 'ru'
          ? `Подготовь официальную аналитическую записку для учебно-методического объединения (УМО) с обоснованием перераспределения учебных часов по предмету «${bundle.active_subject.name_ru}» (Перераспределено: ${bundle.optimization_plan.summary.total_hours_shifted} ч из ${bundle.optimization_plan.summary.baseline_total_hours} ч, прогнозируемый прирост усвоения: +${bundle.optimization_plan.summary.projected_subject_gain}%).
1. Укажи темы-доноры (почему сокращение часов по ним безопасно для качества знаний).
2. Укажи темы-реципиенты (почему увеличение часов критически необходимо и как оно снизит долю неуспевающих).
3. Опиши ожидаемый образовательный эффект.`
          : `Draft an official Methodological Board Justification Memo for the recommended teaching-hour redistribution in "${bundle.active_subject.name_en}" (${bundle.optimization_plan.summary.total_hours_shifted}h reallocated across ${bundle.optimization_plan.summary.baseline_total_hours}h total budget; projected mastery gain: +${bundle.optimization_plan.summary.projected_subject_gain}%).
1. Justify the donor topics (why streamlining hours from high-mastery topics is statistically safe).
2. Justify the recipient topics (how adding hours addresses high LDI and prerequisite ripple risks).
3. Summarize the projected impact on student mastery and struggle-rate reduction.`;
    } else {
      userPrompt =
        lang === 'ru'
          ? `Сформируй комплексное исполнительное резюме (Executive Analytical Report) для главного методиста по предмету «${bundle.active_subject.name_ru}»:
1. Главные выводы по качеству усвоения программы и критическим пробелам.
2. Сравнительный вердикт по учебникам.
3. Приоритетный план перераспределения часов и методических интервенций на следующую четверть.`
          : `Generate an Executive Analytical Curriculum Report for the Lead Methodologist on "${bundle.active_subject.name_en}":
1. Key findings on curriculum effectiveness and critical learning bottlenecks.
2. Evidence-based verdict on textbook efficacy and value-added performance.
3. Priority teaching-hour reallocation and pedagogical action plan for the upcoming term.`;
    }

    const { text, modelUsed } = await callGeminiAPI({
      systemPrompt,
      userPrompt,
      temperature: 0.3
    });

    logAiInsight({
      datasetId: bundle.active_dataset.id,
      subjectId: bundle.active_subject.id,
      mode: analysisType,
      promptSummary: `${analysisType}${targetTopicCode ? ` (${targetTopicCode})` : ''}`,
      responseMarkdown: text,
      modelUsed
    });

    res.json({
      analysis: text,
      analysisType,
      targetTopicCode,
      modelUsed,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: `Gemini AI Error: ${err.message}`
    });
  }
});

app.get('/api/ai/history', (req, res) => {
  try {
    const rows = db
      .prepare('SELECT * FROM ai_insights_log ORDER BY id DESC LIMIT 15')
      .all();
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const distPath = path.join(ROOT_DIR, 'dist');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CurricuLab AI Platform running at http://localhost:${port}`);
  });
}

startServer();
