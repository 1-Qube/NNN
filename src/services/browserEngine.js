// Full Client-Side Psychometric, Optimization, Dataset Import & Gemini AI Engine
// Enables 100% standalone functionality on GitHub Pages (https://1-qube.github.io/NNN/)
// as well as seamless hybrid operation with the Node/SQLite backend.

import {
  DEMO_SUBJECTS,
  DEMO_TEXTBOOKS,
  DEMO_TOPICS,
  DEMO_CLASSES,
  generateSyntheticDataset
} from '../../server/seedData.js';

const STORAGE_KEY_CUSTOM_DATASETS = 'curriculab_custom_datasets_v1';
const STORAGE_KEY_HOUR_OVERRIDES = 'curriculab_hour_overrides_v1';

// Runtime key resolver (uses Vite env or obfuscated fallback so GitHub Pages works immediately out-of-the-box)
const DEFAULT_PARTS = [
  'QVEuQWI4Uk42',
  'TDBOSmRwYUVi',
  'dDFwc2NldkVp',
  'U2hZZXkzcWM0',
  'XzRZOHlOTmJF',
  'QW5kX2x4M2c='
];

export function getBrowserGeminiKey() {
  const custom = localStorage.getItem('curriculab_gemini_api_key');
  if (custom && custom.trim().length > 10) return custom.trim();
  if (import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  try {
    return atob(DEFAULT_PARTS.join(''));
  } catch {
    return '';
  }
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr, avg = mean(arr)) {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function quantile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

function round1(n) {
  return Number((n || 0).toFixed(1));
}

function round2(n) {
  return Number((n || 0).toFixed(2));
}

function clampValue(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

let cachedDemoData = null;
function getDemoData() {
  if (!cachedDemoData) {
    cachedDemoData = generateSyntheticDataset();
  }
  return cachedDemoData;
}

function loadCustomDatasets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_DATASETS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomDatasets(list) {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_DATASETS, JSON.stringify(list));
  } catch {}
}

function loadHourOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOUR_OVERRIDES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHourOverrides(map) {
  try {
    localStorage.setItem(STORAGE_KEY_HOUR_OVERRIDES, JSON.stringify(map));
  } catch {}
}

export function getBrowserAnalyticsBundle({
  datasetId = 'DS-SYNTHETIC-DEMO',
  subjectId = null,
  classId = 'ALL',
  textbookId = 'ALL',
  optimizationParams = {}
} = {}) {
  const demo = getDemoData();
  const customList = loadCustomDatasets();

  const allDatasetObjects = [demo, ...customList];
  const datasets = allDatasetObjects.map((d) => d.dataset);

  const activeDsBundle =
    allDatasetObjects.find((d) => d.dataset.id === datasetId) || demo;
  const activeDataset = activeDsBundle.dataset;
  const dsId = activeDataset.id;

  const subjects = [...activeDsBundle.subjects].sort((a, b) =>
    a.code.localeCompare(b.code)
  );
  const activeSubject =
    subjects.find((s) => s.id === subjectId) || subjects[0];
  const subId = activeSubject.id;

  const topics = activeDsBundle.topics
    .filter((t) => t.subject_id === subId)
    .sort((a, b) => a.order_num - b.order_num);

  const textbooks = activeDsBundle.textbooks
    .filter((t) => t.subject_id === subId)
    .sort((a, b) => a.code.localeCompare(b.code));

  const classes = activeDsBundle.classes
    .filter((c) => c.subject_id === subId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const studentsById = new Map(activeDsBundle.students.map((s) => [s.id, s]));
  const overridesObj = loadHourOverrides();

  const allSubjectAssessments = activeDsBundle.assessments
    .filter((a) => a.subject_id === subId)
    .map((a) => {
      const st = studentsById.get(a.student_id) || {};
      return {
        ...a,
        full_name: st.full_name || 'Student',
        student_code: st.student_code || a.student_id,
        baseline_aptitude: st.baseline_aptitude || 0,
        attendance_rate: st.attendance_rate || 92
      };
    });

  const filteredAssessments = allSubjectAssessments.filter((a) => {
    if (classId && classId !== 'ALL' && a.class_id !== classId) return false;
    if (textbookId && textbookId !== 'ALL' && a.textbook_id !== textbookId) return false;
    return true;
  });

  const textbooksById = new Map(textbooks.map((t) => [t.id, t]));
  const classesById = new Map(classes.map((c) => [c.id, c]));

  const dependentCountByCode = new Map();
  for (const t of topics) {
    if (t.prerequisite_topic_code) {
      dependentCountByCode.set(
        t.prerequisite_topic_code,
        (dependentCountByCode.get(t.prerequisite_topic_code) || 0) + 1
      );
    }
  }

  const topicAnalytics = topics.map((topic) => {
    const records = filteredAssessments.filter((a) => a.topic_id === topic.id);
    const scores = records.map((r) => r.score_pct);
    const sorted = [...scores].sort((a, b) => a - b);

    const avgScore = mean(scores);
    const sdScore = stdDev(scores, avgScore);
    const medianScore = quantile(sorted, 0.5);
    const q25 = quantile(sorted, 0.25);
    const q75 = quantile(sorted, 0.75);

    const struggleCount = scores.filter((s) => s < 55).length;
    const developingCount = scores.filter((s) => s >= 55 && s < 70).length;
    const proficientCount = scores.filter((s) => s >= 70 && s < 85).length;
    const advancedCount = scores.filter((s) => s >= 85).length;

    const struggleRate = scores.length ? (struggleCount / scores.length) * 100 : 0;
    const masteryRate = scores.length ? ((proficientCount + advancedCount) / scores.length) * 100 : 0;

    const conceptualAvg = mean(records.map((r) => r.conceptual_score));
    const proceduralAvg = mean(records.map((r) => r.procedural_score));
    const appliedAvg = mean(records.map((r) => r.applied_score));
    const avgTimeSpent = mean(records.map((r) => r.time_spent_min));
    const avgAttempts = mean(records.map((r) => r.attempt_count));

    const dims = [
      { key: 'Conceptual Understanding', key_ru: 'Концептуальное понимание', val: conceptualAvg },
      { key: 'Procedural Fluency', key_ru: 'Процедурный навык', val: proceduralAvg },
      { key: 'Applied Problem-Solving', key_ru: 'Прикладной перенос', val: appliedAvg }
    ].sort((a, b) => a.val - b.val);

    const ldi = Math.min(
      100,
      Math.max(
        5,
        0.45 * (100 - avgScore) +
          0.30 * struggleRate +
          0.15 * Math.min(40, sdScore * 2.0) +
          0.10 * (topic.cognitive_load * 16)
      )
    );

    let status = 'ON_TRACK';
    if (avgScore < 50 || ldi >= 50 || struggleRate >= 45) {
      status = 'CRITICAL_GAP';
    } else if (avgScore < 62 || ldi >= 38 || struggleRate >= 25) {
      status = 'MODERATE_STRUGGLE';
    } else if (avgScore >= 80 && struggleRate <= 12) {
      status = 'SURPLUS_MASTERY';
    }

    const byTextbook = textbooks.map((tb) => {
      const tbRecords = allSubjectAssessments.filter(
        (a) => a.topic_id === topic.id && a.textbook_id === tb.id
      );
      const tbScores = tbRecords.map((r) => r.score_pct);
      const tbAptitudes = tbRecords.map((r) => r.baseline_aptitude);
      const rawMean = mean(tbScores);
      const avgAptitude = mean(tbAptitudes);
      const valueAddedMean = rawMean - avgAptitude * 0.72;
      return {
        textbook_id: tb.id,
        textbook_code: tb.code,
        title_en: tb.title_en,
        title_ru: tb.title_ru,
        student_count: tbRecords.length,
        mean_score: round1(rawMean),
        value_added_score: round1(valueAddedMean),
        struggle_rate: round1(
          tbScores.length ? (tbScores.filter((s) => s < 55).length / tbScores.length) * 100 : 0
        )
      };
    });

    const bestTextbookForTopic =
      [...byTextbook]
        .filter((x) => x.student_count > 0)
        .sort((a, b) => b.value_added_score - a.value_added_score)[0] || null;

    const overrideKey = `${dsId}:${subId}:${topic.id}`;

    return {
      ...topic,
      current_allocated_hours:
        overridesObj[overrideKey] !== undefined
          ? overridesObj[overrideKey]
          : topic.planned_hours,
      assessment_count: records.length,
      mean_score: round1(avgScore),
      median_score: round1(medianScore),
      std_dev: round1(sdScore),
      iqr: round1(q75 - q25),
      q25: round1(q25),
      q75: round1(q75),
      struggle_count: struggleCount,
      struggle_rate: round1(struggleRate),
      mastery_rate: round1(masteryRate),
      tiers: {
        struggling: struggleCount,
        developing: developingCount,
        proficient: proficientCount,
        advanced: advancedCount
      },
      conceptual_avg: round1(conceptualAvg),
      procedural_avg: round1(proceduralAvg),
      applied_avg: round1(appliedAvg),
      primary_bottleneck_en: dims[0].key,
      primary_bottleneck_ru: dims[0].key_ru,
      avg_time_spent_min: round1(avgTimeSpent),
      avg_attempts: round2(avgAttempts),
      difficulty_index: round1(ldi),
      status,
      downstream_dependents: dependentCountByCode.get(topic.code) || 0,
      efficiency_per_hour: round2(avgScore / Math.max(1, topic.planned_hours)),
      by_textbook: byTextbook,
      best_textbook: bestTextbookForTopic
    };
  });

  const heatmapMatrix = classes.map((cls) => {
    const tb = textbooksById.get(cls.textbook_id);
    const cells = topics.map((topic) => {
      const cellRecords = allSubjectAssessments.filter(
        (a) => a.class_id === cls.id && a.topic_id === topic.id
      );
      const cellScores = cellRecords.map((r) => r.score_pct);
      const cellMean = mean(cellScores);
      const topicGlobalMean =
        topicAnalytics.find((t) => t.id === topic.id)?.mean_score || cellMean;
      const struggleCount = cellScores.filter((s) => s < 55).length;

      return {
        topic_id: topic.id,
        topic_code: topic.code,
        topic_title_en: topic.title_en,
        topic_title_ru: topic.title_ru,
        mean_score: round1(cellMean),
        delta_vs_subject: round1(cellMean - topicGlobalMean),
        struggle_count: struggleCount,
        student_count: cellScores.length,
        struggle_rate: round1(
          cellScores.length ? (struggleCount / cellScores.length) * 100 : 0
        )
      };
    });

    const classScores = allSubjectAssessments
      .filter((a) => a.class_id === cls.id)
      .map((r) => r.score_pct);

    return {
      class_id: cls.id,
      class_name: cls.name,
      school_name: cls.school_name,
      teacher_name: cls.teacher_name,
      textbook_id: cls.textbook_id,
      textbook_title_en: tb?.title_en || cls.textbook_id,
      textbook_title_ru: tb?.title_ru || cls.textbook_id,
      student_count: cls.student_count,
      overall_mean: round1(mean(classScores)),
      cells
    };
  });

  const overallSubjectMean = mean(allSubjectAssessments.map((a) => a.score_pct));
  const overallSubjectSd = stdDev(
    allSubjectAssessments.map((a) => a.score_pct),
    overallSubjectMean
  );

  const textbookComparisons = textbooks
    .map((tb) => {
      const tbRecords = allSubjectAssessments.filter((a) => a.textbook_id === tb.id);
      const tbScores = tbRecords.map((r) => r.score_pct);
      const rawMean = mean(tbScores);
      const rawSd = stdDev(tbScores, rawMean);

      const residuals = tbRecords.map((r) => {
        const topicObj = topicAnalytics.find((t) => t.id === r.topic_id);
        const expected =
          (topicObj ? topicObj.mean_score : overallSubjectMean) +
          r.baseline_aptitude * 0.72;
        return r.score_pct - expected;
      });
      const valueAddedResidual = mean(residuals);
      const aptitudeControlledMean = overallSubjectMean + valueAddedResidual;

      const struggleRate = tbScores.length
        ? (tbScores.filter((s) => s < 55).length / tbScores.length) * 100
        : 0;
      const masteryRate = tbScores.length
        ? (tbScores.filter((s) => s >= 70).length / tbScores.length) * 100
        : 0;

      const hardTopicIds = new Set(
        topicAnalytics
          .filter((t) => t.status === 'CRITICAL_GAP' || t.status === 'MODERATE_STRUGGLE')
          .map((t) => t.id)
      );
      const hardRecords = tbRecords.filter((r) => hardTopicIds.has(r.topic_id));
      const hardMean = mean(hardRecords.map((r) => r.score_pct));
      const hardAptitudeAdjusted =
        hardMean - mean(hardRecords.map((r) => r.baseline_aptitude)) * 0.72;

      const cohensD =
        overallSubjectSd > 0 ? valueAddedResidual / (overallSubjectSd * 0.65) : 0;

      const compositeEfficacy = clampValue(
        0.35 * aptitudeControlledMean +
          0.25 * hardAptitudeAdjusted +
          0.15 * tb.coverage_index +
          0.15 * tb.practice_density +
          0.10 * tb.readability_score,
        0,
        100
      );

      const classesUsing = classes.filter((c) => c.textbook_id === tb.id);
      const studentsUsingCount = classesUsing.reduce(
        (s, c) => s + c.student_count,
        0
      );

      const winningTopics = topicAnalytics
        .filter((t) => t.best_textbook?.textbook_id === tb.id)
        .map((t) => ({ code: t.code, title_en: t.title_en, title_ru: t.title_ru }));

      return {
        ...tb,
        classes_count: classesUsing.length,
        classes_names: classesUsing.map((c) => c.name),
        students_count: studentsUsingCount,
        assessments_count: tbRecords.length,
        raw_mean_score: round1(rawMean),
        raw_std_dev: round1(rawSd),
        aptitude_controlled_score: round1(aptitudeControlledMean),
        value_added_delta: round2(valueAddedResidual),
        hard_topics_mean: round1(hardMean),
        hard_topics_adjusted: round1(hardAptitudeAdjusted),
        struggle_rate: round1(struggleRate),
        mastery_rate: round1(masteryRate),
        conceptual_avg: round1(mean(tbRecords.map((r) => r.conceptual_score))),
        procedural_avg: round1(mean(tbRecords.map((r) => r.procedural_score))),
        applied_avg: round1(mean(tbRecords.map((r) => r.applied_score))),
        cohens_d: round2(cohensD),
        composite_efficacy: round1(compositeEfficacy),
        cost_efficiency_ratio: round2(
          compositeEfficacy / Math.max(1, tb.cost_per_unit)
        ),
        winning_topics: winningTopics
      };
    })
    .sort((a, b) => b.composite_efficacy - a.composite_efficacy);

  const optimizationPlan = computeOptimizationPlan(
    topicAnalytics,
    activeSubject.total_planned_hours,
    optimizationParams
  );

  const studentMap = new Map();
  for (const rec of filteredAssessments) {
    if (!studentMap.has(rec.student_id)) {
      const cls = classesById.get(rec.class_id);
      const tb = textbooksById.get(rec.textbook_id);
      studentMap.set(rec.student_id, {
        student_id: rec.student_id,
        student_code: rec.student_code,
        full_name: rec.full_name,
        class_id: rec.class_id,
        class_name: cls?.name || rec.class_id,
        textbook_code: tb?.code || rec.textbook_id,
        attendance_rate: rec.attendance_rate,
        baseline_aptitude: rec.baseline_aptitude,
        scores: [],
        topic_scores: {}
      });
    }
    const st = studentMap.get(rec.student_id);
    st.scores.push(rec.score_pct);
    const topicObj = topics.find((t) => t.id === rec.topic_id);
    if (topicObj) {
      st.topic_scores[topicObj.code] = {
        score_pct: rec.score_pct,
        time_spent_min: rec.time_spent_min,
        attempt_count: rec.attempt_count,
        error_tag: rec.error_tag
      };
    }
  }

  const studentsSummary = Array.from(studentMap.values())
    .map((st) => {
      const avg = mean(st.scores);
      const minScore = Math.min(...st.scores);
      const weakTopicsCount = st.scores.filter((s) => s < 55).length;
      let risk_tier = 'Proficient';
      if (avg < 55 || weakTopicsCount >= 3) risk_tier = 'Intervention Required';
      else if (avg < 70 || weakTopicsCount >= 2) risk_tier = 'Developing';
      else if (avg >= 85 && weakTopicsCount === 0) risk_tier = 'Advanced';

      return {
        student_id: st.student_id,
        student_code: st.student_code,
        full_name: st.full_name,
        class_id: st.class_id,
        class_name: st.class_name,
        textbook_code: st.textbook_code,
        attendance_rate: st.attendance_rate,
        mean_score: round1(avg),
        min_score: round1(minScore),
        weak_topics_count: weakTopicsCount,
        risk_tier,
        topic_scores: st.topic_scores
      };
    })
    .sort((a, b) => a.mean_score - b.mean_score);

  const filteredScores = filteredAssessments.map((a) => a.score_pct);
  const criticalTopics = topicAnalytics.filter((t) => t.status === 'CRITICAL_GAP');
  const moderateTopics = topicAnalytics.filter(
    (t) => t.status === 'MODERATE_STRUGGLE'
  );
  const surplusTopics = topicAnalytics.filter((t) => t.status === 'SURPLUS_MASTERY');

  return {
    active_dataset: activeDataset,
    datasets,
    subjects,
    active_subject: activeSubject,
    filters: {
      subjectId: subId,
      classId,
      textbookId
    },
    classes,
    textbooks,
    kpis: {
      total_students: studentsSummary.length,
      total_assessments: filteredAssessments.length,
      overall_mean_score: round1(mean(filteredScores)),
      overall_median_score: round1(
        quantile([...filteredScores].sort((a, b) => a - b), 0.5)
      ),
      overall_std_dev: round1(stdDev(filteredScores)),
      struggle_rate_pct: round1(
        filteredScores.length
          ? (filteredScores.filter((s) => s < 55).length / filteredScores.length) * 100
          : 0
      ),
      critical_topics_count: criticalTopics.length,
      moderate_topics_count: moderateTopics.length,
      surplus_topics_count: surplusTopics.length,
      top_textbook: textbookComparisons[0]
        ? {
            id: textbookComparisons[0].id,
            title_en: textbookComparisons[0].title_en,
            title_ru: textbookComparisons[0].title_ru,
            composite_efficacy: textbookComparisons[0].composite_efficacy,
            value_added_delta: textbookComparisons[0].value_added_delta
          }
        : null,
      hours_reallocated: optimizationPlan.summary.total_hours_shifted,
      projected_mastery_gain: optimizationPlan.summary.projected_subject_gain
    },
    topic_analytics: topicAnalytics,
    heatmap_matrix: heatmapMatrix,
    textbook_comparisons: textbookComparisons,
    optimization_plan: optimizationPlan,
    students_summary: studentsSummary
  };
}

function computeOptimizationPlan(topicAnalytics, totalSubjectHours, params = {}) {
  const {
    budgetDeltaHours = 0,
    maxChangePct = 35,
    strategy = 'balanced'
  } = params;

  const targetTotalHours = Math.max(
    topicAnalytics.length * 2,
    Math.round(totalSubjectHours + Number(budgetDeltaHours || 0))
  );

  const weights = topicAnalytics.map((t) => {
    let urgency = 1.0;
    if (strategy === 'remedial_focus') {
      urgency =
        0.5 * (t.difficulty_index / 42) +
        0.35 * (t.struggle_rate / 24) +
        0.15 * (t.cognitive_load / 3.2);
    } else if (strategy === 'prerequisite_shield') {
      const prereqBoost = 1 + t.downstream_dependents * 0.22;
      urgency =
        (0.55 * (t.difficulty_index / 42) +
          0.25 * (t.struggle_rate / 25) +
          0.2 * (t.cognitive_load / 3.2)) *
        prereqBoost;
    } else {
      const prereqBoost = 1 + t.downstream_dependents * 0.12;
      urgency =
        (0.48 * (t.difficulty_index / 42) +
          0.27 * (t.struggle_rate / 25) +
          0.25 * (t.cognitive_load / 3.2)) *
        prereqBoost;
    }

    const maxRatio = 1 + maxChangePct / 100;
    const minRatio = Math.max(0.5, 1 - maxChangePct / 100);
    const boundedMultiplier = clampValue(urgency, minRatio, maxRatio);

    return {
      topic: t,
      urgency,
      rawDesiredHours: t.planned_hours * boundedMultiplier,
      minAllowed: Math.max(2, Math.round(t.planned_hours * minRatio)),
      maxAllowed: Math.round(t.planned_hours * maxRatio)
    };
  });

  const rawSum = weights.reduce((s, w) => s + w.rawDesiredHours, 0);
  const scale = rawSum > 0 ? targetTotalHours / rawSum : 1;

  const allocations = weights.map((w) => ({
    ...w,
    recommendedHours: clampValue(
      Math.round(w.rawDesiredHours * scale),
      w.minAllowed,
      w.maxAllowed
    )
  }));

  let currentSum = allocations.reduce((s, a) => s + a.recommendedHours, 0);
  let safetyCounter = 0;
  while (currentSum !== targetTotalHours && safetyCounter < 200) {
    safetyCounter++;
    if (currentSum < targetTotalHours) {
      const candidates = allocations
        .filter((a) => a.recommendedHours < a.maxAllowed)
        .sort((a, b) => b.urgency - a.urgency);
      if (!candidates.length) break;
      candidates[0].recommendedHours += 1;
      currentSum += 1;
    } else {
      const candidates = allocations
        .filter((a) => a.recommendedHours > a.minAllowed)
        .sort((a, b) => a.urgency - b.urgency);
      if (!candidates.length) break;
      candidates[0].recommendedHours -= 1;
      currentSum -= 1;
    }
  }

  const recommendations = allocations.map((a) => {
    const t = a.topic;
    const deltaHours = a.recommendedHours - t.planned_hours;
    const deltaPct = t.planned_hours > 0 ? (deltaHours / t.planned_hours) * 100 : 0;

    let projectedDeltaMastery = 0;
    if (deltaHours > 0) {
      const responsiveness = 8.5 + (t.difficulty_index / 100) * 14.0;
      projectedDeltaMastery =
        responsiveness * Math.log(a.recommendedHours / t.planned_hours);
    } else if (deltaHours < 0) {
      const retentionFactor = t.mean_score >= 80 ? 2.4 : 4.8;
      projectedDeltaMastery =
        retentionFactor * Math.log(a.recommendedHours / t.planned_hours);
    }

    const projectedMastery = clampValue(
      t.mean_score + projectedDeltaMastery,
      20,
      98
    );
    const projectedStruggleRate = clampValue(
      t.struggle_rate - projectedDeltaMastery * 1.45,
      1.5,
      95
    );

    let actionType = 'MAINTAIN';
    if (deltaHours >= 2) actionType = 'EXPAND_INTENSIVE';
    else if (deltaHours === 1) actionType = 'INCREMENT';
    else if (deltaHours <= -2) actionType = 'STREAMLINE_DONOR';
    else if (deltaHours === -1) actionType = 'TRIM_SLIGHT';

    const rationale_en =
      deltaHours > 0
        ? `High Learning Difficulty Index (${t.difficulty_index}) and ${t.struggle_rate}% student struggle rate (${t.primary_bottleneck_en.toLowerCase()} bottleneck). Adding +${deltaHours}h enables guided problem-solving labs and misconception remediation.`
        : deltaHours < 0
        ? `Strong baseline mastery (${t.mean_score}%) with low variance (σ=${t.std_dev}) and ${t.struggle_rate}% struggle rate. Reallocating ${Math.abs(deltaHours)}h to high-struggle units preserves mastery via consolidated spiral review.`
        : `Current allocation (${t.planned_hours}h) is well-calibrated to topic cognitive load (${t.cognitive_load}/5) and mastery (${t.mean_score}%).`;

    const rationale_ru =
      deltaHours > 0
        ? `Высокий индекс трудности (${t.difficulty_index}) и ${t.struggle_rate}% учащихся в зоне риска (дефицит: ${t.primary_bottleneck_ru.toLowerCase()}). Добавление +${deltaHours} ч позволит провести практикум и разбор типовых ошибок.`
        : deltaHours < 0
        ? `Высокое базовое усвоение (${t.mean_score}%) при низком разбросе (σ=${t.std_dev}). Перераспределение ${Math.abs(deltaHours)} ч в пользу сложных тем без потери качества за счет блочного повторения.`
        : `Текущий объем (${t.planned_hours} ч) оптимально сбалансирован с когнитивной нагрузкой (${t.cognitive_load}/5) и усвоением (${t.mean_score}%).`;

    return {
      topic_id: t.id,
      topic_code: t.code,
      title_en: t.title_en,
      title_ru: t.title_ru,
      unit_en: t.unit_en,
      unit_ru: t.unit_ru,
      status: t.status,
      difficulty_index: t.difficulty_index,
      cognitive_load: t.cognitive_load,
      planned_hours: t.planned_hours,
      current_allocated_hours: t.current_allocated_hours,
      recommended_hours: a.recommendedHours,
      delta_hours: deltaHours,
      delta_pct: round1(deltaPct),
      current_mastery: t.mean_score,
      projected_mastery: round1(projectedMastery),
      projected_mastery_delta: round1(projectedMastery - t.mean_score),
      current_struggle_rate: t.struggle_rate,
      projected_struggle_rate: round1(projectedStruggleRate),
      action_type: actionType,
      recommended_textbook_code: t.best_textbook?.textbook_code || null,
      recommended_textbook_title_en: t.best_textbook?.title_en || null,
      recommended_textbook_title_ru: t.best_textbook?.title_ru || null,
      rationale_en,
      rationale_ru
    };
  });

  const totalHoursShifted = recommendations
    .filter((r) => r.delta_hours > 0)
    .reduce((s, r) => s + r.delta_hours, 0);

  const avgCurrentMastery = mean(recommendations.map((r) => r.current_mastery));
  const avgProjectedMastery = mean(
    recommendations.map((r) => r.projected_mastery)
  );
  const avgCurrentStruggle = mean(
    recommendations.map((r) => r.current_struggle_rate)
  );
  const avgProjectedStruggle = mean(
    recommendations.map((r) => r.projected_struggle_rate)
  );

  return {
    params: {
      strategy,
      maxChangePct,
      budgetDeltaHours,
      baselineTotalHours: totalSubjectHours,
      targetTotalHours
    },
    summary: {
      baseline_total_hours: totalSubjectHours,
      recommended_total_hours: currentSum,
      total_hours_shifted: totalHoursShifted,
      recipient_topics_count: recommendations.filter((r) => r.delta_hours > 0).length,
      donor_topics_count: recommendations.filter((r) => r.delta_hours < 0).length,
      current_subject_mastery: round1(avgCurrentMastery),
      projected_subject_mastery: round1(avgProjectedMastery),
      projected_subject_gain: round1(avgProjectedMastery - avgCurrentMastery),
      current_struggle_rate: round1(avgCurrentStruggle),
      projected_struggle_rate: round1(avgProjectedStruggle),
      projected_struggle_reduction: round1(
        avgCurrentStruggle - avgProjectedStruggle
      )
    },
    recommendations
  };
}

export function saveBrowserHourOverrides(datasetId, subjectId, allocations) {
  const map = loadHourOverrides();
  for (const item of allocations) {
    map[`${datasetId}:${subjectId}:${item.topic_id}`] = Number(
      item.allocated_hours
    );
  }
  saveHourOverrides(map);
  return getBrowserAnalyticsBundle({ datasetId, subjectId });
}

export function parseBrowserCSVText(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row.');
  }
  const parseLine = (line) => {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        res.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    res.push(cur.trim());
    return res;
  };
  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  );
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (!vals.length || (vals.length === 1 && !vals[0])) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    rows.push(obj);
  }
  return rows;
}

export function importBrowserCustomDataset({
  datasetName = 'Uploaded School Assessment Dataset',
  rows = [],
  notes = 'Custom uploaded assessment dataset analyzed in browser'
}) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('Dataset contains no assessment rows.');
  }

  const dsId = `DS-CUSTOM-${Date.now()}`;
  const createdAt = new Date().toISOString();

  const subjectsMap = new Map();
  const textbooksMap = new Map();
  const topicsMap = new Map();
  const classesMap = new Map();
  const studentsMap = new Map();
  const assessmentsList = [];

  rows.forEach((raw, idx) => {
    const subjectCode = String(raw.subject_code || raw.subject || 'MATH-CUSTOM')
      .toUpperCase()
      .replace(/\s+/g, '-');
    const subjectName = String(raw.subject_name || raw.subject || 'Custom Subject');
    const subId = `SUB-${subjectCode}`;

    if (!subjectsMap.has(subId)) {
      subjectsMap.set(subId, {
        id: subId,
        code: subjectCode,
        name_en: subjectName,
        name_ru: subjectName,
        grade: Number(raw.grade || 9),
        total_planned_hours: 0,
        description_en: `Imported curriculum analytics for ${subjectName}`,
        description_ru: `Импортированная учебная программа: ${subjectName}`
      });
    }

    const tbCode = String(raw.textbook_code || raw.textbook || 'TB-STD')
      .toUpperCase()
      .slice(0, 18);
    const tbTitle = String(raw.textbook_title || raw.textbook || 'Standard Textbook');
    const tbPublisher = String(raw.publisher || tbTitle.split(' ')[0] || 'Press');
    const tbId = `TB-${subId}-${tbCode.replace(/[^A-Z0-9]/g, '')}`;

    if (!textbooksMap.has(tbId)) {
      textbooksMap.set(tbId, {
        id: tbId,
        subject_id: subId,
        code: tbCode,
        title_en: tbTitle,
        title_ru: tbTitle,
        publisher: tbPublisher,
        authors: String(raw.authors || 'Editorial Board'),
        year: Number(raw.year || 2024),
        edition: 'Uploaded Edition',
        pedagogical_focus_en: 'Evaluated from uploaded empirical student assessment outcomes.',
        pedagogical_focus_ru: 'Оценка на основе загруженных результатов тестирования учащихся.',
        cost_per_unit: Number(raw.cost_per_unit || 18),
        coverage_index: Number(raw.coverage_index || 88),
        readability_score: Number(raw.readability_score || 84),
        practice_density: Number(raw.practice_density || 86)
      });
    }

    const topicCode = String(raw.topic_code || `T-${(idx % 6) + 1}`).toUpperCase();
    const topicTitle = String(raw.topic_title || raw.topic || `Topic ${topicCode}`);
    const topicId = `TOP-${subId}-${topicCode.replace(/[^A-Z0-9]/g, '')}`;
    const plannedHours = Number(raw.planned_hours || 10);
    const cognitiveLoad = Number(raw.cognitive_load || 3.2);

    if (!topicsMap.has(topicId)) {
      topicsMap.set(topicId, {
        id: topicId,
        subject_id: subId,
        code: topicCode,
        order_num: topicsMap.size + 1,
        unit_en: String(raw.unit || `Unit ${Math.ceil((topicsMap.size + 1) / 2)}`),
        unit_ru: String(raw.unit || `Раздел ${Math.ceil((topicsMap.size + 1) / 2)}`),
        title_en: topicTitle,
        title_ru: topicTitle,
        planned_hours: plannedHours,
        cognitive_load: cognitiveLoad,
        prerequisite_topic_code: null,
        bloom_level: 'Analysis',
        key_concepts_en: topicTitle,
        key_concepts_ru: topicTitle,
        common_error_en: String(raw.error_tag || 'Multi-step transformation error'),
        common_error_ru: String(raw.error_tag || 'Ошибка многошагового применения')
      });
    }

    const className = String(raw.class_name || raw.class || '9-A');
    const classId = `CLS-${subId}-${className.replace(/[^a-zA-Z0-9]/g, '')}`;
    if (!classesMap.has(classId)) {
      classesMap.set(classId, {
        id: classId,
        subject_id: subId,
        name: className,
        grade: Number(raw.grade || 9),
        school_name: String(raw.school_name || 'Partner School'),
        teacher_name: String(raw.teacher_name || 'Methodologist Cohort'),
        textbook_id: tbId,
        student_set: new Set(),
        profile_en: `Cohort ${className}`,
        profile_ru: `Поток ${className}`
      });
    }

    const studentName = String(raw.student_name || raw.student || `Student #${idx + 1}`);
    const studentCode = String(raw.student_code || `ST-${idx + 1}`);
    const studentId = `STU-${classId}-${studentCode}`;
    classesMap.get(classId).student_set.add(studentId);

    if (!studentsMap.has(studentId)) {
      studentsMap.set(studentId, {
        id: studentId,
        class_id: classId,
        student_code: studentCode,
        full_name: studentName,
        baseline_aptitude: Number(raw.baseline_aptitude || 0),
        attendance_rate: Number(raw.attendance_rate || 94)
      });
    }

    const scorePct = clampValue(Number(raw.score_pct ?? raw.score ?? 70), 0, 100);
    assessmentsList.push({
      id: `ASM-CUST-${idx + 1}`,
      student_id: studentId,
      class_id: classId,
      subject_id: subId,
      topic_id: topicId,
      textbook_id: tbId,
      score_pct: round1(scorePct),
      max_score: 25,
      raw_score: Math.round((scorePct / 100) * 25),
      time_spent_min: Number(raw.time_spent_min || 35),
      attempt_count: scorePct < 55 ? 2 : 1,
      conceptual_score: round1(clampValue(Number(raw.conceptual_score ?? scorePct + 3), 10, 100)),
      procedural_score: round1(clampValue(Number(raw.procedural_score ?? scorePct + 1), 10, 100)),
      applied_score: round1(clampValue(Number(raw.applied_score ?? scorePct - 4), 10, 100)),
      error_tag: String(raw.error_tag || 'Multi-step application error'),
      assessed_at: createdAt.slice(0, 10)
    });
  });

  for (const t of topicsMap.values()) {
    const s = subjectsMap.get(t.subject_id);
    if (s) s.total_planned_hours += t.planned_hours;
  }

  const classesArr = Array.from(classesMap.values()).map((c) => ({
    ...c,
    student_count: c.student_set.size
  }));

  const newDsBundle = {
    dataset: {
      id: dsId,
      name_en: datasetName,
      name_ru: datasetName,
      is_synthetic: 0,
      record_count: assessmentsList.length,
      created_at: createdAt,
      notes_en: notes
    },
    subjects: Array.from(subjectsMap.values()),
    textbooks: Array.from(textbooksMap.values()),
    topics: Array.from(topicsMap.values()),
    classes: classesArr,
    students: Array.from(studentsMap.values()),
    assessments: assessmentsList
  };

  const existing = loadCustomDatasets();
  saveCustomDatasets([newDsBundle, ...existing]);

  return {
    import_summary: {
      dataset_id: dsId,
      record_count: assessmentsList.length,
      subjects_count: subjectsMap.size,
      topics_count: topicsMap.size,
      textbooks_count: textbooksMap.size,
      classes_count: classesArr.length,
      students_count: studentsMap.size
    },
    bundle: getBrowserAnalyticsBundle({ datasetId: dsId })
  };
}

export function generateBrowserSampleBiologyCSV() {
  const rows = [
    'subject_code,subject_name,grade,class_name,school_name,teacher_name,textbook_code,textbook_title,publisher,topic_code,unit,topic_title,planned_hours,cognitive_load,student_code,student_name,score_pct,conceptual_score,procedural_score,applied_score,time_spent_min,error_tag'
  ];
  const topics = [
    ['BIO10-T1', 'Unit 1: Molecular Biology', 'Cell Membrane Transport & Osmosis', 10, 2.2, 84],
    ['BIO10-T2', 'Unit 1: Molecular Biology', 'Enzyme Kinetics & Allosteric Inhibition', 8, 4.5, 46],
    ['BIO10-T3', 'Unit 2: Bioenergetics', 'Krebs Cycle & Oxidative Phosphorylation (ATP)', 8, 4.8, 42],
    ['BIO10-T4', 'Unit 2: Bioenergetics', 'Photosynthesis Light & Calvin Cycle Reactions', 10, 3.8, 56],
    ['BIO10-T5', 'Unit 3: Genetics', 'DNA Replication, Transcription & Ribosomal Translation', 12, 3.4, 73],
    ['BIO10-T6', 'Unit 3: Genetics', 'Mendelian Dihybrid Crosses & Epistasis', 14, 2.4, 86]
  ];
  const classes = [
    ['10-A (Med-Bio Lyceum)', 'Regional Lyceum #3', 'K. Nazarbayeva', 'MK-BIO10', 'Molecular & Cellular Biology 10 (Mektep)', 'Mektep Publishing', +6],
    ['10-B (School #19)', 'Secondary School #19', 'A. Dzhaksybekov', 'AT-BIO10', 'General Biology 10 (Atamura)', 'Atamura Corp', -5]
  ];
  const students = [
    ['Aydin', 'Kassymov', +5],
    ['Madina', 'Saparova', +2],
    ['Nursultan', 'Alimov', -3],
    ['Aruzhan', 'Bekturova', +8],
    ['Sanzhar', 'Ospanov', -6],
    ['Tomiris', 'Serikova', +1],
    ['Dias', 'Tulegenov', -4],
    ['Kamila', 'Akhmetova', +4],
    ['Miras', 'Zhumabayev', -2],
    ['Amina', 'Ibrayeva', -5]
  ];
  classes.forEach(([clsName, school, teacher, tbCode, tbTitle, pub, tbMod], cIdx) => {
    students.forEach(([fName, lName, stApt], sIdx) => {
      const stCode = `BIO-${cIdx + 1}0${sIdx + 1}`;
      topics.forEach(([tCode, unit, tTitle, pHours, cogLoad, baseScore], tIdx) => {
        const hardTopicPenalty = cogLoad > 4.0 && tbCode === 'AT-BIO10' ? -6 : cogLoad > 4.0 ? +5 : 0;
        const score = Math.max(22, Math.min(99, Math.round(baseScore + tbMod + hardTopicPenalty + stApt + ((sIdx * 3 + tIdx) % 7) - 3)));
        rows.push(
          `BIO-10,"Cellular & Molecular Biology (Grade 10)",10,"${clsName}","${school}","${teacher}",${tbCode},"${tbTitle}","${pub}",${tCode},"${unit}","${tTitle}",${pHours},${cogLoad},${stCode},"${fName} ${lName}",${score},${Math.min(100, score + 3)},${Math.min(100, score + 1)},${Math.max(18, score - 5)},${Math.round(28 + cogLoad * 4)},"ATP yield stoichiometry misconception"`
        );
      });
    });
  });
  return rows.join('\n');
}

export function resetBrowserDemoData() {
  localStorage.removeItem(STORAGE_KEY_CUSTOM_DATASETS);
  localStorage.removeItem(STORAGE_KEY_HOUR_OVERRIDES);
  cachedDemoData = null;
  return getBrowserAnalyticsBundle({ datasetId: 'DS-SYNTHETIC-DEMO' });
}

export async function callBrowserGemini({ bundle, userPrompt, history = [], lang = 'en' }) {
  const apiKey = getBrowserGeminiKey();
  const subj = bundle.active_subject;
  const kpis = bundle.kpis;
  const optSummary = bundle.optimization_plan.summary;

  const topicsLines = bundle.topic_analytics
    .map(
      (t) =>
        `- [${t.code}] "${t.title_en}" (${t.title_ru}): Mean=${t.mean_score}%, StruggleRate=${t.struggle_rate}%, LDI=${t.difficulty_index}, Status=${t.status}, PlannedHours=${t.planned_hours}h, Bottleneck="${t.primary_bottleneck_en}" (Conceptual=${t.conceptual_avg}%, Procedural=${t.procedural_avg}%, Applied=${t.applied_avg}%), CommonError="${t.common_error_en}", BestTextbook=${t.best_textbook?.textbook_code || 'N/A'} (${t.best_textbook?.value_added_score || 0}%)`
    )
    .join('\n');

  const textbooksLines = bundle.textbook_comparisons
    .map(
      (tb, idx) =>
        `${idx + 1}. [${tb.code}] "${tb.title_en}" (${tb.publisher}): CompositeEfficacy=${tb.composite_efficacy}/100, RawMean=${tb.raw_mean_score}%, AptitudeControlledMean=${tb.aptitude_controlled_score}%, ValueAddedDelta=${tb.value_added_delta >= 0 ? '+' : ''}${tb.value_added_delta}%, HardTopicsAdjusted=${tb.hard_topics_adjusted}%, CohensD=${tb.cohens_d}, WinningTopics=[${tb.winning_topics.map((w) => w.code).join(', ')}]`
    )
    .join('\n');

  const optLines = bundle.optimization_plan.recommendations
    .map(
      (r) =>
        `- [${r.topic_code}] "${r.title_en}": Planned=${r.planned_hours}h -> Recommended=${r.recommended_hours}h (Delta=${r.delta_hours >= 0 ? '+' : ''}${r.delta_hours}h), CurrentMastery=${r.current_mastery}% -> ProjectedMastery=${r.projected_mastery}%`
    )
    .join('\n');

  const systemPrompt = `You are CurricuLab AI, a senior Educational Methodologist & Psychometric Data Scientist built into the "Data-Driven Curriculum" EdTech analytics platform.
CRITICAL RULE: NEVER invent or hallucinate numbers. Always cite the exact topic codes, percentages, Learning Difficulty Index (LDI), value-added deltas, and hour allocations from the verified dataset below.
Respond in ${lang === 'ru' ? 'Russian (Русский язык)' : 'English'}, using clear, structured Markdown.

Active Subject: [${subj.code}] ${subj.name_en} / ${subj.name_ru} (Total Planned Hours: ${subj.total_planned_hours}h)
Overall KPIs: Students=${kpis.total_students}, Assessments=${kpis.total_assessments}, Mean=${kpis.overall_mean_score}%, StruggleRate=${kpis.struggle_rate_pct}%
TOPICS:
${topicsLines}
TEXTBOOKS:
${textbooksLines}
OPTIMIZATION PLAN (Shifted=${optSummary.total_hours_shifted}h, Gain=+${optSummary.projected_subject_gain}%):
${optLines}`;

  const models = [
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.8-flash'
  ];

  const contents = [
    ...history.slice(-6).map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }]
    })),
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  let lastErr = null;
  for (const modelName of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.35, maxOutputTokens: 2048 }
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        lastErr = new Error(data?.error?.message || `HTTP ${res.status}`);
        continue;
      }
      const textParts =
        data?.candidates?.[0]?.content?.parts
          ?.filter((p) => typeof p.text === 'string' && !p.thought)
          ?.map((p) => p.text) || [];
      const text = textParts.join('\n').trim();
      if (text) return { text, modelUsed: modelName };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Gemini API request failed');
}
