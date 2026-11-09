import { db } from './db.js';

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

export function getDatasetsList() {
  return db.prepare('SELECT * FROM datasets ORDER BY is_synthetic DESC, created_at DESC').all();
}

export function getAnalyticsBundle({
  datasetId = 'DS-SYNTHETIC-DEMO',
  subjectId = null,
  classId = 'ALL',
  textbookId = 'ALL',
  optimizationParams = {}
} = {}) {
  const datasets = getDatasetsList();
  const activeDataset = datasets.find((d) => d.id === datasetId) || datasets[0];
  const dsId = activeDataset.id;

  const subjects = db
    .prepare('SELECT * FROM subjects WHERE dataset_id = ? ORDER BY code ASC')
    .all(dsId);

  const activeSubject =
    subjects.find((s) => s.id === subjectId) ||
    subjects[0];

  if (!activeSubject) {
    throw new Error(`No subjects found for dataset ${dsId}`);
  }

  const subId = activeSubject.id;

  const topics = db
    .prepare('SELECT * FROM topics WHERE dataset_id = ? AND subject_id = ? ORDER BY order_num ASC')
    .all(dsId, subId);

  const textbooks = db
    .prepare('SELECT * FROM textbooks WHERE dataset_id = ? AND subject_id = ? ORDER BY code ASC')
    .all(dsId, subId);

  const classes = db
    .prepare('SELECT * FROM classes WHERE dataset_id = ? AND subject_id = ? ORDER BY name ASC')
    .all(dsId, subId);

  const overridesRows = db
    .prepare('SELECT topic_id, allocated_hours FROM curriculum_hour_overrides WHERE dataset_id = ? AND subject_id = ?')
    .all(dsId, subId);
  const overridesMap = new Map(overridesRows.map((r) => [r.topic_id, r.allocated_hours]));

  // All assessments for this subject (unfiltered for cross-class & textbook comparisons)
  const allSubjectAssessments = db
    .prepare(`
      SELECT a.*, s.full_name, s.student_code, s.baseline_aptitude, s.attendance_rate
      FROM assessments a
      JOIN students s ON s.id = a.student_id AND s.dataset_id = a.dataset_id
      WHERE a.dataset_id = ? AND a.subject_id = ?
    `)
    .all(dsId, subId);

  // Filtered assessments for current Class / Textbook selection
  const filteredAssessments = allSubjectAssessments.filter((a) => {
    if (classId && classId !== 'ALL' && a.class_id !== classId) return false;
    if (textbookId && textbookId !== 'ALL' && a.textbook_id !== textbookId) return false;
    return true;
  });

  const textbooksById = new Map(textbooks.map((t) => [t.id, t]));
  const classesById = new Map(classes.map((c) => [c.id, c]));

  // Count downstream dependents for each topic
  const dependentCountByCode = new Map();
  for (const t of topics) {
    if (t.prerequisite_topic_code) {
      dependentCountByCode.set(
        t.prerequisite_topic_code,
        (dependentCountByCode.get(t.prerequisite_topic_code) || 0) + 1
      );
    }
  }

  // 1. Topic Analytics
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

    // Bottleneck dimension diagnosis
    const dims = [
      { key: 'Conceptual Understanding', key_ru: 'Концептуальное понимание', val: conceptualAvg },
      { key: 'Procedural Fluency', key_ru: 'Процедурный навык', val: proceduralAvg },
      { key: 'Applied Problem-Solving', key_ru: 'Прикладной перенос', val: appliedAvg }
    ].sort((a, b) => a.val - b.val);

    // Learning Difficulty Index (0-100)
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

    // Per-textbook breakdown on this topic (using allSubjectAssessments so textbook comparison is complete)
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

    const bestTextbookForTopic = [...byTextbook]
      .filter((x) => x.student_count > 0)
      .sort((a, b) => b.value_added_score - a.value_added_score)[0] || null;

    return {
      ...topic,
      current_allocated_hours: overridesMap.has(topic.id)
        ? overridesMap.get(topic.id)
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

  // 2. Class x Topic Heatmap Matrix
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

  // 3. Textbook Comparison Analytics (Raw + Aptitude-Adjusted Value-Added + Cohen's d)
  const overallSubjectMean = mean(allSubjectAssessments.map((a) => a.score_pct));
  const overallSubjectSd = stdDev(
    allSubjectAssessments.map((a) => a.score_pct),
    overallSubjectMean
  );

  const textbookComparisons = textbooks.map((tb) => {
    const tbRecords = allSubjectAssessments.filter((a) => a.textbook_id === tb.id);
    const tbScores = tbRecords.map((r) => r.score_pct);
    const rawMean = mean(tbScores);
    const rawSd = stdDev(tbScores, rawMean);

    // Value-added residual controlling for student baseline aptitude and topic difficulty
    const residuals = tbRecords.map((r) => {
      const topicObj = topicAnalytics.find((t) => t.id === r.topic_id);
      const expected = (topicObj ? topicObj.mean_score : overallSubjectMean) + r.baseline_aptitude * 0.72;
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

    // Effect size on difficult topics (CRITICAL_GAP & MODERATE_STRUGGLE)
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

    // Composite Curriculum Efficacy Score (0-100)
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
    const studentsUsingCount = classesUsing.reduce((s, c) => s + c.student_count, 0);

    // Topics where this textbook ranks #1 in value-added mastery
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
      cost_efficiency_ratio: round2(compositeEfficacy / Math.max(1, tb.cost_per_unit)),
      winning_topics: winningTopics
    };
  }).sort((a, b) => b.composite_efficacy - a.composite_efficacy);

  // 4. Teaching-Hour Optimization Algorithm
  const optimizationPlan = computeCurriculumOptimization(
    topicAnalytics,
    activeSubject.total_planned_hours,
    optimizationParams
  );

  // 5. Student Performance Explorer (for selected class/textbook filter)
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

  // Executive KPIs
  const filteredScores = filteredAssessments.map((a) => a.score_pct);
  const criticalTopics = topicAnalytics.filter((t) => t.status === 'CRITICAL_GAP');
  const moderateTopics = topicAnalytics.filter((t) => t.status === 'MODERATE_STRUGGLE');
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

function clampValue(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function computeCurriculumOptimization(
  topicAnalytics,
  totalSubjectHours,
  params = {}
) {
  const {
    budgetDeltaHours = 0, // 0 = strict zero-sum reallocation; can also be +4, +8, etc.
    maxChangePct = 35, // max % change per topic
    strategy = 'balanced' // 'balanced' | 'remedial_focus' | 'prerequisite_shield'
  } = params;

  const targetTotalHours = Math.max(
    topicAnalytics.length * 2,
    Math.round(totalSubjectHours + Number(budgetDeltaHours || 0))
  );

  // Compute raw urgency weight for each topic
  const weights = topicAnalytics.map((t) => {
    let urgency = 1.0;
    if (strategy === 'remedial_focus') {
      // Heavy weight on struggle rate (<55%) and low mean
      urgency =
        0.50 * (t.difficulty_index / 42) +
        0.35 * (t.struggle_rate / 24) +
        0.15 * (t.cognitive_load / 3.2);
    } else if (strategy === 'prerequisite_shield') {
      // Extra weight on prerequisite topics that unlock downstream units
      const prereqBoost = 1 + t.downstream_dependents * 0.22;
      urgency =
        (0.55 * (t.difficulty_index / 42) +
          0.25 * (t.struggle_rate / 25) +
          0.20 * (t.cognitive_load / 3.2)) *
        prereqBoost;
    } else {
      // Balanced psychometric & cognitive load optimization
      const prereqBoost = 1 + t.downstream_dependents * 0.12;
      urgency =
        (0.48 * (t.difficulty_index / 42) +
          0.27 * (t.struggle_rate / 25) +
          0.25 * (t.cognitive_load / 3.2)) *
        prereqBoost;
    }

    // Clamp multiplier to maxChangePct bounds
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

  // Normalize to targetTotalHours and round to whole integers while respecting min/max bounds
  const rawSum = weights.reduce((s, w) => s + w.rawDesiredHours, 0);
  const scale = rawSum > 0 ? targetTotalHours / rawSum : 1;

  const allocations = weights.map((w) => {
    const scaled = clampValue(
      Math.round(w.rawDesiredHours * scale),
      w.minAllowed,
      w.maxAllowed
    );
    return {
      ...w,
      recommendedHours: scaled
    };
  });

  // Exact integer sum reconciliation so total recommended hours === targetTotalHours
  let currentSum = allocations.reduce((s, a) => s + a.recommendedHours, 0);
  let safetyCounter = 0;
  while (currentSum !== targetTotalHours && safetyCounter < 200) {
    safetyCounter++;
    if (currentSum < targetTotalHours) {
      // Add 1 hour to the highest-urgency topic that hasn't hit maxAllowed
      const candidates = allocations
        .filter((a) => a.recommendedHours < a.maxAllowed)
        .sort((a, b) => b.urgency - a.urgency);
      if (!candidates.length) break;
      candidates[0].recommendedHours += 1;
      currentSum += 1;
    } else {
      // Subtract 1 hour from the lowest-urgency topic that is above minAllowed
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

    // Logarithmic learning response model:
    // High-difficulty struggling topics gain significantly from added scaffolding hours;
    // High-mastery donor topics lose minimal mastery when streamlined with flipped/consolidated review.
    let projectedDeltaMastery = 0;
    if (deltaHours > 0) {
      const responsiveness = 8.5 + (t.difficulty_index / 100) * 14.0;
      projectedDeltaMastery =
        responsiveness * Math.log(a.recommendedHours / t.planned_hours);
    } else if (deltaHours < 0) {
      // Donor topic has high mastery (80%+), so compacting redundant drills has low mastery penalty
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

    let rationale_en = '';
    let rationale_ru = '';
    if (deltaHours > 0) {
      rationale_en = `High Learning Difficulty Index (${t.difficulty_index}) and ${t.struggle_rate}% student struggle rate (${t.primary_bottleneck_en.toLowerCase()} bottleneck). Adding +${deltaHours}h enables guided problem-solving labs and misconception remediation.`;
      rationale_ru = `Высокий индекс трудности (${t.difficulty_index}) и ${t.struggle_rate}% учащихся в зоне риска (дефицит: ${t.primary_bottleneck_ru.toLowerCase()}). Добавление +${deltaHours} ч позволит провести практикум и разбор типовых ошибок.`;
    } else if (deltaHours < 0) {
      rationale_en = `Strong baseline mastery (${t.mean_score}%) with low variance (σ=${t.std_dev}) and ${t.struggle_rate}% struggle rate. Reallocating ${Math.abs(deltaHours)}h to high-struggle units preserves mastery via consolidated spiral review.`;
      rationale_ru = `Высокое базовое усвоение (${t.mean_score}%) при низком разбросе (σ=${t.std_dev}). Перераспределение ${Math.abs(deltaHours)} ч в пользу сложных тем без потери качества за счет блочного повторения.`;
    } else {
      rationale_en = `Current allocation (${t.planned_hours}h) is well-calibrated to topic cognitive load (${t.cognitive_load}/5) and mastery (${t.mean_score}%).`;
      rationale_ru = `Текущий объем (${t.planned_hours} ч) оптимально сбалансирован с когнитивной нагрузкой (${t.cognitive_load}/5) и усвоением (${t.mean_score}%).`;
    }

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

  const totalHoursShifted =
    recommendations
      .filter((r) => r.delta_hours > 0)
      .reduce((s, r) => s + r.delta_hours, 0);

  const avgCurrentMastery = mean(recommendations.map((r) => r.current_mastery));
  const avgProjectedMastery = mean(recommendations.map((r) => r.projected_mastery));
  const avgCurrentStruggle = mean(recommendations.map((r) => r.current_struggle_rate));
  const avgProjectedStruggle = mean(recommendations.map((r) => r.projected_struggle_rate));

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
      projected_struggle_reduction: round1(avgCurrentStruggle - avgProjectedStruggle)
    },
    recommendations
  };
}
