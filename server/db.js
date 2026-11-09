import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSyntheticDataset } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'curriculum.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ru TEXT NOT NULL,
      is_synthetic INTEGER NOT NULL DEFAULT 1,
      record_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      notes_en TEXT
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_ru TEXT NOT NULL,
      grade INTEGER NOT NULL,
      total_planned_hours INTEGER NOT NULL,
      description_en TEXT,
      description_ru TEXT,
      PRIMARY KEY (id, dataset_id)
    );

    CREATE TABLE IF NOT EXISTS textbooks (
      id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      code TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_ru TEXT NOT NULL,
      publisher TEXT NOT NULL,
      authors TEXT NOT NULL,
      year INTEGER NOT NULL,
      edition TEXT,
      pedagogical_focus_en TEXT,
      pedagogical_focus_ru TEXT,
      cost_per_unit REAL DEFAULT 18.0,
      coverage_index REAL DEFAULT 88.0,
      readability_score REAL DEFAULT 82.0,
      practice_density REAL DEFAULT 85.0,
      PRIMARY KEY (id, dataset_id)
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      code TEXT NOT NULL,
      order_num INTEGER NOT NULL,
      unit_en TEXT NOT NULL,
      unit_ru TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_ru TEXT NOT NULL,
      planned_hours REAL NOT NULL,
      cognitive_load REAL NOT NULL DEFAULT 3.0,
      prerequisite_topic_code TEXT,
      bloom_level TEXT,
      key_concepts_en TEXT,
      key_concepts_ru TEXT,
      common_error_en TEXT,
      common_error_ru TEXT,
      PRIMARY KEY (id, dataset_id)
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL,
      school_name TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      textbook_id TEXT NOT NULL,
      student_count INTEGER NOT NULL,
      profile_en TEXT,
      profile_ru TEXT,
      PRIMARY KEY (id, dataset_id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      student_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      baseline_aptitude REAL DEFAULT 0,
      attendance_rate REAL DEFAULT 92,
      PRIMARY KEY (id, dataset_id)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      textbook_id TEXT NOT NULL,
      score_pct REAL NOT NULL,
      max_score REAL NOT NULL,
      raw_score REAL NOT NULL,
      time_spent_min REAL NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      conceptual_score REAL NOT NULL,
      procedural_score REAL NOT NULL,
      applied_score REAL NOT NULL,
      error_tag TEXT,
      assessed_at TEXT,
      PRIMARY KEY (id, dataset_id)
    );

    CREATE INDEX IF NOT EXISTS idx_assessments_ds_subj ON assessments(dataset_id, subject_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_ds_topic ON assessments(dataset_id, topic_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_ds_class ON assessments(dataset_id, class_id);

    CREATE TABLE IF NOT EXISTS curriculum_hour_overrides (
      dataset_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      allocated_hours REAL NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (dataset_id, subject_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS ai_insights_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_id TEXT NOT NULL,
      subject_id TEXT,
      mode TEXT NOT NULL,
      prompt_summary TEXT NOT NULL,
      response_markdown TEXT NOT NULL,
      model_used TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const existingDemo = db.prepare('SELECT id FROM datasets WHERE id = ?').get('DS-SYNTHETIC-DEMO');
  if (!existingDemo) {
    seedDemoDataset();
  }
}

export function seedDemoDataset() {
  const data = generateSyntheticDataset();
  const dsId = data.dataset.id;

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('DELETE FROM datasets WHERE id = ?').run(dsId);
    db.prepare('DELETE FROM subjects WHERE dataset_id = ?').run(dsId);
    db.prepare('DELETE FROM textbooks WHERE dataset_id = ?').run(dsId);
    db.prepare('DELETE FROM topics WHERE dataset_id = ?').run(dsId);
    db.prepare('DELETE FROM classes WHERE dataset_id = ?').run(dsId);
    db.prepare('DELETE FROM students WHERE dataset_id = ?').run(dsId);
    db.prepare('DELETE FROM assessments WHERE dataset_id = ?').run(dsId);
    db.prepare('DELETE FROM curriculum_hour_overrides WHERE dataset_id = ?').run(dsId);

    db.prepare(`
      INSERT INTO datasets (id, name_en, name_ru, is_synthetic, record_count, created_at, notes_en)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.dataset.id,
      data.dataset.name_en,
      data.dataset.name_ru,
      data.dataset.is_synthetic,
      data.dataset.record_count,
      data.dataset.created_at,
      data.dataset.notes_en
    );

    const insSubject = db.prepare(`
      INSERT INTO subjects (id, dataset_id, code, name_en, name_ru, grade, total_planned_hours, description_en, description_ru)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of data.subjects) {
      insSubject.run(s.id, dsId, s.code, s.name_en, s.name_ru, s.grade, s.total_planned_hours, s.description_en, s.description_ru);
    }

    const insTextbook = db.prepare(`
      INSERT INTO textbooks (id, dataset_id, subject_id, code, title_en, title_ru, publisher, authors, year, edition, pedagogical_focus_en, pedagogical_focus_ru, cost_per_unit, coverage_index, readability_score, practice_density)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tb of data.textbooks) {
      insTextbook.run(
        tb.id, dsId, tb.subject_id, tb.code, tb.title_en, tb.title_ru, tb.publisher, tb.authors,
        tb.year, tb.edition, tb.pedagogical_focus_en, tb.pedagogical_focus_ru,
        tb.cost_per_unit, tb.coverage_index, tb.readability_score, tb.practice_density
      );
    }

    const insTopic = db.prepare(`
      INSERT INTO topics (id, dataset_id, subject_id, code, order_num, unit_en, unit_ru, title_en, title_ru, planned_hours, cognitive_load, prerequisite_topic_code, bloom_level, key_concepts_en, key_concepts_ru, common_error_en, common_error_ru)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of data.topics) {
      insTopic.run(
        t.id, dsId, t.subject_id, t.code, t.order_num, t.unit_en, t.unit_ru, t.title_en, t.title_ru,
        t.planned_hours, t.cognitive_load, t.prerequisite_topic_code, t.bloom_level,
        t.key_concepts_en, t.key_concepts_ru, t.common_error_en, t.common_error_ru
      );
    }

    const insClass = db.prepare(`
      INSERT INTO classes (id, dataset_id, subject_id, name, grade, school_name, teacher_name, textbook_id, student_count, profile_en, profile_ru)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of data.classes) {
      insClass.run(
        c.id, dsId, c.subject_id, c.name, c.grade, c.school_name, c.teacher_name,
        c.textbook_id, c.student_count, c.profile_en, c.profile_ru
      );
    }

    const insStudent = db.prepare(`
      INSERT INTO students (id, dataset_id, class_id, student_code, full_name, baseline_aptitude, attendance_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const st of data.students) {
      insStudent.run(st.id, dsId, st.class_id, st.student_code, st.full_name, st.baseline_aptitude, st.attendance_rate);
    }

    const insAssessment = db.prepare(`
      INSERT INTO assessments (id, dataset_id, student_id, class_id, subject_id, topic_id, textbook_id, score_pct, max_score, raw_score, time_spent_min, attempt_count, conceptual_score, procedural_score, applied_score, error_tag, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of data.assessments) {
      insAssessment.run(
        a.id, dsId, a.student_id, a.class_id, a.subject_id, a.topic_id, a.textbook_id,
        a.score_pct, a.max_score, a.raw_score, a.time_spent_min, a.attempt_count,
        a.conceptual_score, a.procedural_score, a.applied_score, a.error_tag, a.assessed_at
      );
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
