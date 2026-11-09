import { db } from './db.js';

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseCSVText(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row.');
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length === 0 || (vals.length === 1 && !vals[0])) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    rows.push(obj);
  }
  return rows;
}

export function importCustomDataset({
  datasetName = 'Uploaded School Assessment Dataset',
  rows = [],
  notes = 'Custom uploaded assessment dataset analyzed by CurricuLab Engine'
}) {
  if (!Array.isArray(rows) || rows.length === 0) {
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
    const subjectName = String(raw.subject_name || raw.subject || 'Custom Subject Curriculum');
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

    const tbCode = String(raw.textbook_code || raw.textbook || 'TB-STANDARD')
      .toUpperCase()
      .slice(0, 18);
    const tbTitle = String(raw.textbook_title || raw.textbook || 'Standard Curriculum Textbook');
    const tbPublisher = String(raw.publisher || tbTitle.split(' ')[0] || 'Educational Press');
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
        edition: String(raw.edition || 'Uploaded Edition'),
        pedagogical_focus_en: String(
          raw.pedagogical_focus || 'Evaluated from uploaded empirical student assessment outcomes.'
        ),
        pedagogical_focus_ru: String(
          raw.pedagogical_focus || 'Оценка на основе загруженных результатов тестирования учащихся.'
        ),
        cost_per_unit: Number(raw.cost_per_unit || 18.0),
        coverage_index: Number(raw.coverage_index || 88.0),
        readability_score: Number(raw.readability_score || 84.0),
        practice_density: Number(raw.practice_density || 86.0)
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
        prerequisite_topic_code: raw.prerequisite_topic_code || null,
        bloom_level: String(raw.bloom_level || 'Analysis'),
        key_concepts_en: String(raw.key_concepts || topicTitle),
        key_concepts_ru: String(raw.key_concepts || topicTitle),
        common_error_en: String(
          raw.error_tag || raw.common_error || 'Multi-step transformation & application error'
        ),
        common_error_ru: String(
          raw.error_tag || raw.common_error || 'Ошибка многошагового преобразования и применения'
        )
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
        school_name: String(raw.school_name || 'Uploaded Partner School'),
        teacher_name: String(raw.teacher_name || 'Methodologist Cohort'),
        textbook_id: tbId,
        student_set: new Set(),
        profile_en: `Cohort ${className} (${tbTitle})`,
        profile_ru: `Поток ${className} (${tbTitle})`
      });
    }

    const studentName = String(raw.student_name || raw.student || `Student #${(idx % 25) + 1}`);
    const studentCode = String(
      raw.student_code || `ST-${className.replace(/[^A-Z0-9]/gi, '')}-${studentName.replace(/\s+/g, '').slice(0, 6)}`
    );
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

    const scorePct = Math.max(
      0,
      Math.min(100, Number(raw.score_pct ?? raw.score ?? 70))
    );
    const maxScore = Number(raw.max_score || 25);
    const rawScore = Number(raw.raw_score ?? Math.round((scorePct / 100) * maxScore));

    const conceptualScore = Number(
      raw.conceptual_score ?? Math.min(100, Math.max(10, scorePct + 3.5))
    );
    const proceduralScore = Number(
      raw.procedural_score ?? Math.min(100, Math.max(10, scorePct + 1.0))
    );
    const appliedScore = Number(
      raw.applied_score ?? Math.min(100, Math.max(10, scorePct - 4.5))
    );

    assessmentsList.push({
      id: `ASM-CUST-${idx + 1}`,
      student_id: studentId,
      class_id: classId,
      subject_id: subId,
      topic_id: topicId,
      textbook_id: tbId,
      score_pct: Number(scorePct.toFixed(1)),
      max_score: maxScore,
      raw_score: rawScore,
      time_spent_min: Number(raw.time_spent_min || 35),
      attempt_count: Number(raw.attempt_count || (scorePct < 55 ? 2 : 1)),
      conceptual_score: Number(conceptualScore.toFixed(1)),
      procedural_score: Number(proceduralScore.toFixed(1)),
      applied_score: Number(appliedScore.toFixed(1)),
      error_tag: String(
        raw.error_tag ||
          (scorePct < 60
            ? topicsMap.get(topicId).common_error_en
            : 'None / Minor slip')
      ),
      assessed_at: String(raw.assessed_at || createdAt.slice(0, 10))
    });
  });

  // Sum planned hours per subject
  for (const topic of topicsMap.values()) {
    const subj = subjectsMap.get(topic.subject_id);
    if (subj) {
      subj.total_planned_hours += topic.planned_hours;
    }
  }

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare(`
      INSERT INTO datasets (id, name_en, name_ru, is_synthetic, record_count, created_at, notes_en)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `).run(dsId, datasetName, datasetName, assessmentsList.length, createdAt, notes);

    const insSubject = db.prepare(`
      INSERT INTO subjects (id, dataset_id, code, name_en, name_ru, grade, total_planned_hours, description_en, description_ru)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of subjectsMap.values()) {
      insSubject.run(
        s.id,
        dsId,
        s.code,
        s.name_en,
        s.name_ru,
        s.grade,
        Math.max(12, s.total_planned_hours),
        s.description_en,
        s.description_ru
      );
    }

    const insTextbook = db.prepare(`
      INSERT INTO textbooks (id, dataset_id, subject_id, code, title_en, title_ru, publisher, authors, year, edition, pedagogical_focus_en, pedagogical_focus_ru, cost_per_unit, coverage_index, readability_score, practice_density)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tb of textbooksMap.values()) {
      insTextbook.run(
        tb.id,
        dsId,
        tb.subject_id,
        tb.code,
        tb.title_en,
        tb.title_ru,
        tb.publisher,
        tb.authors,
        tb.year,
        tb.edition,
        tb.pedagogical_focus_en,
        tb.pedagogical_focus_ru,
        tb.cost_per_unit,
        tb.coverage_index,
        tb.readability_score,
        tb.practice_density
      );
    }

    const insTopic = db.prepare(`
      INSERT INTO topics (id, dataset_id, subject_id, code, order_num, unit_en, unit_ru, title_en, title_ru, planned_hours, cognitive_load, prerequisite_topic_code, bloom_level, key_concepts_en, key_concepts_ru, common_error_en, common_error_ru)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of topicsMap.values()) {
      insTopic.run(
        t.id,
        dsId,
        t.subject_id,
        t.code,
        t.order_num,
        t.unit_en,
        t.unit_ru,
        t.title_en,
        t.title_ru,
        t.planned_hours,
        t.cognitive_load,
        t.prerequisite_topic_code,
        t.bloom_level,
        t.key_concepts_en,
        t.key_concepts_ru,
        t.common_error_en,
        t.common_error_ru
      );
    }

    const insClass = db.prepare(`
      INSERT INTO classes (id, dataset_id, subject_id, name, grade, school_name, teacher_name, textbook_id, student_count, profile_en, profile_ru)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of classesMap.values()) {
      insClass.run(
        c.id,
        dsId,
        c.subject_id,
        c.name,
        c.grade,
        c.school_name,
        c.teacher_name,
        c.textbook_id,
        c.student_set.size,
        c.profile_en,
        c.profile_ru
      );
    }

    const insStudent = db.prepare(`
      INSERT INTO students (id, dataset_id, class_id, student_code, full_name, baseline_aptitude, attendance_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const st of studentsMap.values()) {
      insStudent.run(
        st.id,
        dsId,
        st.class_id,
        st.student_code,
        st.full_name,
        st.baseline_aptitude,
        st.attendance_rate
      );
    }

    const insAssessment = db.prepare(`
      INSERT INTO assessments (id, dataset_id, student_id, class_id, subject_id, topic_id, textbook_id, score_pct, max_score, raw_score, time_spent_min, attempt_count, conceptual_score, procedural_score, applied_score, error_tag, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of assessmentsList) {
      insAssessment.run(
        a.id,
        dsId,
        a.student_id,
        a.class_id,
        a.subject_id,
        a.topic_id,
        a.textbook_id,
        a.score_pct,
        a.max_score,
        a.raw_score,
        a.time_spent_min,
        a.attempt_count,
        a.conceptual_score,
        a.procedural_score,
        a.applied_score,
        a.error_tag,
        a.assessed_at
      );
    }

    db.exec('COMMIT');
    return {
      dataset_id: dsId,
      record_count: assessmentsList.length,
      subjects_count: subjectsMap.size,
      topics_count: topicsMap.size,
      textbooks_count: textbooksMap.size,
      classes_count: classesMap.size,
      students_count: studentsMap.size
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function generateSampleUploadCSV() {
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
        const conc = Math.min(100, score + 3);
        const proc = Math.min(100, score + 1);
        const appl = Math.max(18, score - 5);
        const timeMin = Math.round(28 + cogLoad * 4);
        const err = score < 58 ? 'ATP yield stoichiometry & proton gradient misconception' : 'None';
        rows.push(
          `BIO-10,"Cellular & Molecular Biology (Grade 10)",10,"${clsName}","${school}","${teacher}",${tbCode},"${tbTitle}","${pub}",${tCode},"${unit}","${tTitle}",${pHours},${cogLoad},${stCode},"${fName} ${lName}",${score},${conc},${proc},${appl},${timeMin},"${err}"`
        );
      });
    });
  });

  return rows.join('\n');
}
