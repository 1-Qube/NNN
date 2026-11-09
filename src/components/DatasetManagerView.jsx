import React, { useState } from 'react';
import {
  Database,
  Upload,
  Download,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
  Play
} from 'lucide-react';
import {
  parseBrowserCSVText,
  importBrowserCustomDataset,
  generateBrowserSampleBiologyCSV,
  resetBrowserDemoData
} from '../services/browserEngine.js';

const INLINE_EDITABLE_SAMPLE_CSV = `subject_code,subject_name,grade,class_name,school_name,teacher_name,textbook_code,textbook_title,publisher,topic_code,unit,topic_title,planned_hours,cognitive_load,student_code,student_name,score_pct
GEO-09,Economic & Physical Geography (Grade 9),9,9-A Lyceum,Taraz Lyceum #1,A. Kassymova,MK-GEO9,Geography of Kazakhstan 9 (Mektep),Mektep Press,G9-T1,Unit 1: Cartography & GIS,Topographic Projections & GIS Spatial Analysis,8,4.6,GEO-101,Alikhan Saparov,46
GEO-09,Economic & Physical Geography (Grade 9),9,9-A Lyceum,Taraz Lyceum #1,A. Kassymova,MK-GEO9,Geography of Kazakhstan 9 (Mektep),Mektep Press,G9-T1,Unit 1: Cartography & GIS,Topographic Projections & GIS Spatial Analysis,8,4.6,GEO-102,Aruzhan Nurgaliyeva,51
GEO-09,Economic & Physical Geography (Grade 9),9,9-A Lyceum,Taraz Lyceum #1,A. Kassymova,MK-GEO9,Geography of Kazakhstan 9 (Mektep),Mektep Press,G9-T2,Unit 2: Geomorphology,Tectonic Structures & Mineral Resources,12,2.4,GEO-101,Alikhan Saparov,86
GEO-09,Economic & Physical Geography (Grade 9),9,9-A Lyceum,Taraz Lyceum #1,A. Kassymova,MK-GEO9,Geography of Kazakhstan 9 (Mektep),Mektep Press,G9-T2,Unit 2: Geomorphology,Tectonic Structures & Mineral Resources,12,2.4,GEO-102,Aruzhan Nurgaliyeva,89
GEO-09,Economic & Physical Geography (Grade 9),9,9-A Lyceum,Taraz Lyceum #1,A. Kassymova,MK-GEO9,Geography of Kazakhstan 9 (Mektep),Mektep Press,G9-T3,Unit 3: Climate & Hydrography,Atmospheric Circulation & Continental River Basins,10,4.2,GEO-101,Alikhan Saparov,54
GEO-09,Economic & Physical Geography (Grade 9),9,9-A Lyceum,Taraz Lyceum #1,A. Kassymova,MK-GEO9,Geography of Kazakhstan 9 (Mektep),Mektep Press,G9-T3,Unit 3: Climate & Hydrography,Atmospheric Circulation & Continental River Basins,10,4.2,GEO-102,Aruzhan Nurgaliyeva,58
GEO-09,Economic & Physical Geography (Grade 9),9,9-B School #24,City School #24,M. Ospanov,AT-GEO9,Applied Geography & Economy 9 (Atamura),Atamura Corp,G9-T1,Unit 1: Cartography & GIS,Topographic Projections & GIS Spatial Analysis,8,4.6,GEO-201,Sanzhar Tulegenov,39
GEO-09,Economic & Physical Geography (Grade 9),9,9-B School #24,City School #24,M. Ospanov,AT-GEO9,Applied Geography & Economy 9 (Atamura),Atamura Corp,G9-T1,Unit 1: Cartography & GIS,Topographic Projections & GIS Spatial Analysis,8,4.6,GEO-202,Madina Akhmetova,44
GEO-09,Economic & Physical Geography (Grade 9),9,9-B School #24,City School #24,M. Ospanov,AT-GEO9,Applied Geography & Economy 9 (Atamura),Atamura Corp,G9-T2,Unit 2: Geomorphology,Tectonic Structures & Mineral Resources,12,2.4,GEO-201,Sanzhar Tulegenov,81
GEO-09,Economic & Physical Geography (Grade 9),9,9-B School #24,City School #24,M. Ospanov,AT-GEO9,Applied Geography & Economy 9 (Atamura),Atamura Corp,G9-T2,Unit 2: Geomorphology,Tectonic Structures & Mineral Resources,12,2.4,GEO-202,Madina Akhmetova,84
GEO-09,Economic & Physical Geography (Grade 9),9,9-B School #24,City School #24,M. Ospanov,AT-GEO9,Applied Geography & Economy 9 (Atamura),Atamura Corp,G9-T3,Unit 3: Climate & Hydrography,Atmospheric Circulation & Continental River Basins,10,4.2,GEO-201,Sanzhar Tulegenov,64
GEO-09,Economic & Physical Geography (Grade 9),9,9-B School #24,City School #24,M. Ospanov,AT-GEO9,Applied Geography & Economy 9 (Atamura),Atamura Corp,G9-T3,Unit 3: Climate & Hydrography,Atmospheric Circulation & Continental River Basins,10,4.2,GEO-202,Madina Akhmetova,68`;

export function DatasetManagerView({
  bundle,
  lang,
  onSelectDataset,
  onUploadSuccess
}) {
  const [datasetName, setDatasetName] = useState('Grade 9 Geography GIS & Climate Cohort (Custom CSV)');
  const [csvText, setCsvText] = useState(INLINE_EDITABLE_SAMPLE_CSV);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDatasetName(file.name.replace(/\.(csv|json)$/i, ''));
    const text = await file.text();
    setCsvText(text);
  };

  const handleDownloadSampleCSV = () => {
    const csv = generateBrowserSampleBiologyCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grade10_biology_assessment_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadCustom = async (e) => {
    e.preventDefault();
    setUploading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const trimmed = csvText.trim();
      const parsedRows = trimmed.startsWith('[')
        ? JSON.parse(trimmed)
        : parseBrowserCSVText(trimmed);

      let data = null;
      try {
        const res = await fetch('/api/datasets/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datasetName, rows: parsedRows })
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch {}

      if (!data) {
        data = importBrowserCustomDataset({
          datasetName,
          rows: parsedRows
        });
      }

      setStatusMsg(
        lang === 'ru'
          ? `Успешно импортировано ${data.import_summary.record_count} оценок (${data.import_summary.students_count} учеников, ${data.import_summary.topics_count} тем). Все графики и ИИ-модель обновлены!`
          : `Successfully imported ${data.import_summary.record_count} assessment records (${data.import_summary.students_count} students, ${data.import_summary.topics_count} topics). All analytics & Gemini context updated!`
      );
      onUploadSuccess(data.bundle);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLoadBiologySample = async () => {
    setUploading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      let data = null;
      try {
        const res = await fetch('/api/datasets/load-sample-biology', { method: 'POST' });
        if (res.ok) data = await res.json();
      } catch {}

      if (!data) {
        const rows = parseBrowserCSVText(generateBrowserSampleBiologyCSV());
        data = importBrowserCustomDataset({
          datasetName: 'Grade 10 Molecular Biology Benchmark (Uploaded CSV Sample)',
          rows,
          notes: 'Imported from Grade 10 Biology 120-assessment multi-textbook cohort CSV.'
        });
      }

      setStatusMsg(
        lang === 'ru'
          ? `Загружен тестовый датасет «Биология 10 класс» (${data.import_summary.record_count} оценок). Переключите вкладку для просмотра новых графиков!`
          : `Loaded "Grade 10 Molecular Biology" dataset (${data.import_summary.record_count} assessments across 2 textbooks and 6 topics)!`
      );
      onUploadSuccess(data.bundle);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleResetDemo = async () => {
    setUploading(true);
    setErrorMsg(null);
    try {
      let newBundle = null;
      try {
        const res = await fetch('/api/datasets/reset-demo', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          newBundle = data.bundle;
        }
      } catch {}

      if (!newBundle) {
        newBundle = resetBrowserDemoData();
      }

      setStatusMsg(
        lang === 'ru'
          ? 'Демонстрационный синтетический датасет восстановлен к исходному состоянию.'
          : 'Synthetic Demonstration Dataset restored to default state.'
      );
      onUploadSuccess(newBundle);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {statusMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--status-success-bg)',
            border: '1px solid var(--status-success-border)',
            color: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600
          }}
        >
          <CheckCircle2 size={18} />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--status-critical-bg)',
            border: '1px solid var(--status-critical-border)',
            color: 'var(--status-critical)',
            fontWeight: 600
          }}
        >
          {errorMsg}
        </div>
      )}

      <div className="panel-grid-2">
        {/* Active & Available Datasets */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Database size={18} color="var(--accent-primary)" />
                {lang === 'ru'
                  ? 'Управление наборами образовательных данных'
                  : 'Educational Assessment Datasets'}
              </div>
              <div className="panel-subtitle">
                {lang === 'ru'
                  ? 'Переключайтесь между демонстрационным синтетическим датасетом и загруженными файлами CSV/JSON'
                  : 'Switch instantaneously between the built-in Synthetic Demonstration Dataset and custom uploaded datasets'}
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResetDemo}
              disabled={uploading}
              id="reset-demo-dataset-btn"
            >
              <RefreshCw size={14} />
              {lang === 'ru' ? 'Сбросить демо-данные' : 'Reset Demo Data'}
            </button>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bundle.datasets.map((ds) => {
              const isActive = ds.id === bundle.active_dataset.id;
              return (
                <div
                  key={ds.id}
                  onClick={() => onSelectDataset(ds.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: isActive
                      ? '2px solid var(--accent-primary)'
                      : '1px solid var(--border-subtle)',
                    background: isActive ? 'var(--accent-primary-soft)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        className={`synthetic-tag ${ds.is_synthetic ? '' : 'empirical'}`}
                      >
                        {ds.is_synthetic
                          ? lang === 'ru'
                            ? 'Синтетические демо-данные'
                            : 'Synthetic Demo Data'
                          : lang === 'ru'
                          ? 'Загруженный датасет'
                          : 'Uploaded Dataset'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>
                        {lang === 'ru' ? ds.name_ru : ds.name_en}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {ds.notes_en}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono" style={{ fontWeight: 700, fontSize: '15px' }}>
                      {ds.record_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {lang === 'ru' ? 'записей оценок' : 'assessments'}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Quick 1-click Biology Sample Importer */}
            <div
              style={{
                marginTop: '8px',
                padding: '14px 16px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                border: '1px dashed var(--border-strong)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
                  {lang === 'ru'
                    ? 'Быстрая проверка загрузки: Биология 10 класс (CSV)'
                    : 'Instant Judge Test: Load Grade 10 Molecular Biology CSV (120 Rows)'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {lang === 'ru'
                    ? 'Импортирует 120 новых результатов тестирования по 6 темам и 2 учебникам («Мектеп» и «Атамұра»)'
                    : 'Imports 120 student topic assessments across 6 Biology topics and 2 textbooks to verify dynamic recalculation'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  className="btn btn-secondary btn-sm"
                >
                  <Download size={14} />
                  {lang === 'ru' ? 'Скачать шаблон CSV' : 'Download CSV Template'}
                </button>
                <button
                  type="button"
                  className="btn btn-teal btn-sm"
                  onClick={handleLoadBiologySample}
                  disabled={uploading}
                  id="load-sample-biology-btn"
                >
                  <Play size={14} />
                  {lang === 'ru' ? 'Импортировать Биологию 10' : 'Import Biology 10 Sample'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Custom CSV / JSON Upload & Live Editor */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Upload size={18} color="var(--accent-teal)" />
                {lang === 'ru'
                  ? 'Загрузка собственного CSV / JSON датасета'
                  : 'Upload or Edit Custom Assessment CSV / JSON'}
              </div>
              <div className="panel-subtitle">
                {lang === 'ru'
                  ? 'Загрузите файл с компьютера или отредактируйте CSV-таблицу ниже и запустите перерасчет аналитики'
                  : 'Select a .csv/.json file from your computer or edit the live CSV rows below and run the analytics engine'}
              </div>
            </div>
          </div>

          <form className="panel-body" onSubmit={handleUploadCustom} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'ru' ? 'Название набора данных:' : 'Dataset Title:'}
                </label>
                <input
                  type="text"
                  className="ai-text-input"
                  style={{ width: '100%' }}
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="csv-file-upload"
                  className="btn btn-secondary"
                  style={{ cursor: 'pointer' }}
                >
                  <FileSpreadsheet size={15} />
                  {lang === 'ru' ? 'Выбрать файл .CSV / .JSON' : 'Choose .CSV / .JSON File'}
                </label>
                <input
                  id="csv-file-upload"
                  type="file"
                  accept=".csv,.json,.txt"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                {lang === 'ru'
                  ? 'Данные CSV или JSON (доступно для редактирования перед импортом):'
                  : 'CSV or JSON Assessment Rows (editable before import):'}
              </label>
              <textarea
                className="mono"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-strong)',
                  fontSize: '11.5px',
                  lineHeight: 1.45,
                  background: 'var(--bg-subtle)'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploading}
                id="submit-custom-dataset-btn"
              >
                <Sparkles size={15} />
                {uploading
                  ? lang === 'ru'
                    ? 'Расчет аналитики...'
                    : 'Calculating Analytics...'
                  : lang === 'ru'
                  ? 'Импортировать и пересчитать платформу'
                  : 'Import Dataset & Recalculate Analytics'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
