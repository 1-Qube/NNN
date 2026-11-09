import dotenv from 'dotenv';
import { db } from './db.js';

dotenv.config();

const MODEL_CHAIN = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.8-flash'
];

export function getGeminiStatus() {
  const key = process.env.GEMINI_API_KEY || '';
  return {
    configured: Boolean(key && key.length > 10),
    keyPrefix: key ? `${key.slice(0, 8)}...` : null,
    models: MODEL_CHAIN
  };
}

export function buildAnalyticsContextPrompt(bundle, lang = 'en') {
  const subj = bundle.active_subject;
  const kpis = bundle.kpis;
  const ds = bundle.active_dataset;

  const topicsLines = bundle.topic_analytics
    .map(
      (t) =>
        `- [${t.code}] "${t.title_en}" (${t.title_ru}): Mean=${t.mean_score}%, Median=${t.median_score}%, SD=${t.std_dev}, StruggleRate(<55%)=${t.struggle_rate}%, LDI=${t.difficulty_index}, Status=${t.status}, PlannedHours=${t.planned_hours}h, Bottleneck="${t.primary_bottleneck_en}" (Conceptual=${t.conceptual_avg}%, Procedural=${t.procedural_avg}%, Applied=${t.applied_avg}%), CommonError="${t.common_error_en}", BestTextbook=${t.best_textbook?.textbook_code || 'N/A'} (${t.best_textbook?.value_added_score || 0}%)`
    )
    .join('\n');

  const textbooksLines = bundle.textbook_comparisons
    .map(
      (tb, idx) =>
        `${idx + 1}. [${tb.code}] "${tb.title_en}" (${tb.publisher}, ${tb.year}): CompositeEfficacy=${tb.composite_efficacy}/100, RawMean=${tb.raw_mean_score}%, AptitudeControlledMean=${tb.aptitude_controlled_score}%, ValueAddedDelta=${tb.value_added_delta > 0 ? '+' : ''}${tb.value_added_delta}%, HardTopicsAdjusted=${tb.hard_topics_adjusted}%, CohensD=${tb.cohens_d}, StruggleRate=${tb.struggle_rate}%, Coverage=${tb.coverage_index}%, PracticeDensity=${tb.practice_density}%, Cost=$${tb.cost_per_unit}, WinningTopics=[${tb.winning_topics.map((w) => w.code).join(', ')}]`
    )
    .join('\n');

  const optSummary = bundle.optimization_plan.summary;
  const optLines = bundle.optimization_plan.recommendations
    .map(
      (r) =>
        `- [${r.topic_code}] "${r.title_en}": Planned=${r.planned_hours}h -> Recommended=${r.recommended_hours}h (Delta=${r.delta_hours > 0 ? '+' : ''}${r.delta_hours}h / ${r.delta_pct}%), CurrentMastery=${r.current_mastery}% -> ProjectedMastery=${r.projected_mastery}% (${r.projected_mastery_delta > 0 ? '+' : ''}${r.projected_mastery_delta}%), Action=${r.action_type}`
    )
    .join('\n');

  const classesLines = bundle.heatmap_matrix
    .map(
      (c) =>
        `- Class "${c.class_name}" (${c.school_name}, Teacher: ${c.teacher_name}, Textbook: ${c.textbook_title_en}): OverallMean=${c.overall_mean}%, Students=${c.student_count}`
    )
    .join('\n');

  return `
You are CurricuLab AI, a senior Educational Methodologist & Psychometric Data Scientist built into the "Data-Driven Curriculum" EdTech analytics platform.
Your role is to interpret REAL statistical calculations performed by the platform's analytics engine.
CRITICAL RULE: NEVER invent or hallucinate numbers. Always cite the exact topic codes, percentages, Learning Difficulty Index (LDI), value-added deltas, and hour allocations from the verified dataset below.
Respond in ${lang === 'ru' ? 'Russian (Русский язык)' : 'English'}, using clear, structured Markdown with bold metrics, bullet points, and actionable methodological recommendations.

=== CURRENT VERIFIED ANALYTICS CONTEXT ===
Dataset: ${ds.name_en} (${ds.is_synthetic ? 'Synthetic Demonstration Dataset' : 'Uploaded Empirical Dataset'})
Active Subject: [${subj.code}] ${subj.name_en} / ${subj.name_ru} (Grade ${subj.grade}, Total Planned Curriculum Hours: ${subj.total_planned_hours}h)
Active Filter: Class=${bundle.filters.classId}, Textbook=${bundle.filters.textbookId}
Overall Subject KPIs:
- Total Students Evaluated: ${kpis.total_students}
- Total Topic Assessments: ${kpis.total_assessments}
- Overall Mean Mastery: ${kpis.overall_mean_score}% (Median: ${kpis.overall_median_score}%, SD: ${kpis.overall_std_dev})
- Overall Student Struggle Rate (<55% score): ${kpis.struggle_rate_pct}%
- Critical Gap Topics: ${kpis.critical_topics_count} | Moderate Struggle Topics: ${kpis.moderate_topics_count} | Surplus Mastery Topics: ${kpis.surplus_topics_count}

=== TOPIC-BY-TOPIC PSYCHOMETRIC BREAKDOWN ===
${topicsLines}

=== TEXTBOOK EFFICACY & VALUE-ADDED BENCHMARK ===
${textbooksLines}

=== CLASS COHORTS ===
${classesLines}

=== CURRICULUM TEACHING-HOUR OPTIMIZATION PLAN ===
Strategy: ${bundle.optimization_plan.params.strategy} | Total Baseline Hours: ${optSummary.baseline_total_hours}h -> Recommended Total Hours: ${optSummary.recommended_total_hours}h | Total Hours Redistributed: ${optSummary.total_hours_shifted}h | Projected Mastery Gain: +${optSummary.projected_subject_gain}% (from ${optSummary.current_subject_mastery}% to ${optSummary.projected_subject_mastery}%), Struggle Reduction: -${optSummary.projected_struggle_reduction}%
${optLines}
`.trim();
}

export async function callGeminiAPI({ systemPrompt, userPrompt, history = [], temperature = 0.35 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  const contents = [];
  for (const msg of history.slice(-8)) {
    contents.push({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(msg.content || msg.text || '') }]
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }]
  });

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: 2048
    }
  };

  let lastError = null;

  for (const modelName of MODEL_CHAIN) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 14000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok) {
        lastError = new Error(
          `Model ${modelName} returned HTTP ${res.status}: ${data?.error?.message || 'Unknown error'}`
        );
        continue;
      }

      const textParts =
        data?.candidates?.[0]?.content?.parts
          ?.filter((p) => typeof p.text === 'string' && !p.thought)
          ?.map((p) => p.text) || [];

      const text = textParts.join('\n').trim();
      if (text) {
        return {
          text,
          modelUsed: modelName
        };
      }
      lastError = new Error(`Model ${modelName} returned empty text.`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed to respond.');
}

export function logAiInsight({ datasetId, subjectId, mode, promptSummary, responseMarkdown, modelUsed }) {
  try {
    db.prepare(`
      INSERT INTO ai_insights_log (dataset_id, subject_id, mode, prompt_summary, response_markdown, model_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      datasetId,
      subjectId || null,
      mode,
      promptSummary.slice(0, 300),
      responseMarkdown,
      modelUsed,
      new Date().toISOString()
    );
  } catch {
    // Non-fatal logging
  }
}
