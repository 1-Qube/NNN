import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  CheckCircle2,
  Award,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer.jsx';
import { T } from '../i18n.js';

export function ReportBuilderView({
  bundle,
  lang,
  savedAiSections,
  onGenerateReportAi,
  isGeneratingAi
}) {
  const [includeTopics, setIncludeTopics] = useState(true);
  const [includeTextbooks, setIncludeTextbooks] = useState(true);
  const [includeHoursPlan, setIncludeHoursPlan] = useState(true);
  const [methodologistName, setMethodologistName] = useState(
    lang === 'ru' ? 'Учебно-методический совет (УМО)' : 'Regional Methodological Board'
  );

  const dict = T[lang] || T.en;
  const subj = bundle.active_subject;
  const kpis = bundle.kpis;
  const opt = bundle.optimization_plan;

  const generateMarkdownDocument = () => {
    const lines = [
      `# ${lang === 'ru' ? 'АНАЛИТИЧЕСКИЙ ОТЧЕТ МЕТОДИСТА' : 'CURRICULUM EFFICACY & OPTIMIZATION REPORT'}`,
      `**${lang === 'ru' ? 'Предмет:' : 'Subject:'}** [${subj.code}] ${lang === 'ru' ? subj.name_ru : subj.name_en}`,
      `**${lang === 'ru' ? 'Набор данных:' : 'Dataset:'}** ${lang === 'ru' ? bundle.active_dataset.name_ru : bundle.active_dataset.name_en} (${bundle.active_dataset.is_synthetic ? 'Synthetic Demonstration Data' : 'Empirical Data'})`,
      `**${lang === 'ru' ? 'Автор / Комиссия:' : 'Prepared by:'}** ${methodologistName}`,
      `**${lang === 'ru' ? 'Дата:' : 'Date:'}** ${new Date().toISOString().slice(0, 10)}`,
      '',
      `## 1. ${lang === 'ru' ? 'Сводные показатели качества (KPI)' : 'Executive Psychometric Summary'}`,
      `- **${dict.kpiMeanMastery}:** ${kpis.overall_mean_score}% (Median: ${kpis.overall_median_score}%, SD: ${kpis.overall_std_dev})`,
      `- **${dict.kpiStruggleRate}:** ${kpis.struggle_rate_pct}% (${kpis.total_students} students, ${kpis.total_assessments} topic assessments)`,
      `- **${dict.kpiCriticalTopics}:** ${kpis.critical_topics_count} critical, ${kpis.moderate_topics_count} moderate struggle`,
      `- **${dict.kpiBestTextbook}:** ${kpis.top_textbook?.title_en || 'N/A'} (Composite Efficacy: ${kpis.top_textbook?.composite_efficacy}/100, Value-Added: +${kpis.top_textbook?.value_added_delta}%)`,
      `- **${dict.kpiOptimizationLift}:** +${opt.summary.projected_subject_gain}% mastery gain (${opt.summary.total_hours_shifted}h redistributed across ${opt.summary.baseline_total_hours}h budget)`,
      ''
    ];

    if (includeTopics) {
      lines.push(`## 2. ${lang === 'ru' ? 'Диагностика тем учебной программы' : 'Topic-Level Learning Gap Diagnosis'}`);
      for (const t of bundle.topic_analytics) {
        lines.push(
          `- **[${t.code}] ${lang === 'ru' ? t.title_ru : t.title_en}**: Mean=${t.mean_score}%, LDI=${t.difficulty_index}, Struggle(<55%)=${t.struggle_rate}%, Status=${t.status}, Bottleneck=${lang === 'ru' ? t.primary_bottleneck_ru : t.primary_bottleneck_en}`
        );
      }
      lines.push('');
    }

    if (includeTextbooks) {
      lines.push(`## 3. ${lang === 'ru' ? 'Сравнительная эффективность учебников' : 'Textbook Efficacy & Value-Added Benchmark'}`);
      for (const tb of bundle.textbook_comparisons) {
        lines.push(
          `- **[${tb.code}] ${lang === 'ru' ? tb.title_ru : tb.title_en}** (${tb.publisher}): Composite=${tb.composite_efficacy}/100, Aptitude-Controlled=${tb.aptitude_controlled_score}%, Value-Added=${tb.value_added_delta >= 0 ? '+' : ''}${tb.value_added_delta}%, Cohen's d=${tb.cohens_d}, Hard-Topics=${tb.hard_topics_adjusted}%`
        );
      }
      lines.push('');
    }

    if (includeHoursPlan) {
      lines.push(`## 4. ${lang === 'ru' ? 'Рекомендации по перераспределению учебных часов' : 'Recommended Teaching-Hour Redistribution Schedule'}`);
      for (const r of opt.recommendations) {
        lines.push(
          `- **[${r.topic_code}] ${lang === 'ru' ? r.title_ru : r.title_en}**: ${r.planned_hours}h -> **${r.recommended_hours}h** (${r.delta_hours >= 0 ? '+' : ''}${r.delta_hours}h) | Mastery: ${r.current_mastery}% -> **${r.projected_mastery}%** | ${lang === 'ru' ? r.rationale_ru : r.rationale_en}`
        );
      }
      lines.push('');
    }

    if (savedAiSections?.length) {
      lines.push(`## 5. ${lang === 'ru' ? 'Экспертное заключение ИИ (Google Gemini)' : 'Gemini AI Methodological Interpretation & Recommendations'}`);
      savedAiSections.forEach((sec, idx) => {
        lines.push(`### AI Section ${idx + 1} (${sec.modelUsed || 'Gemini'})`);
        lines.push(sec.content);
        lines.push('');
      });
    }

    return lines.join('\n');
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownDocument();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CurricuLab_Report_${subj.code}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSVSchedule = () => {
    const headers = [
      'topic_code,topic_title,status,difficulty_index,current_mastery_pct,struggle_rate_pct,planned_hours,recommended_hours,delta_hours,projected_mastery_pct,recommended_textbook'
    ];
    const rows = opt.recommendations.map(
      (r) =>
        `${r.topic_code},"${lang === 'ru' ? r.title_ru : r.title_en}",${r.status},${r.difficulty_index},${r.current_mastery},${r.current_struggle_rate},${r.planned_hours},${r.recommended_hours},${r.delta_hours},${r.projected_mastery},"${r.recommended_textbook_code || ''}"`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], {
      type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Curriculum_Optimization_${subj.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Report Configuration & Export Toolbar */}
      <div className="panel no-print">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <FileText size={18} color="var(--accent-primary)" />
              {lang === 'ru'
                ? 'Генератор аналитических отчетов для методического совета (УМО)'
                : 'Methodological Decision Report Generator & Export'}
            </div>
            <div className="panel-subtitle">
              {lang === 'ru'
                ? 'Сформируйте официальный отчет с расчетами, сравнением учебников, сеткой часов и заключением Gemini AI'
                : 'Compile real statistical tables, textbook adoption verdicts, teaching-hour schedules, and Gemini AI commentary'}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={onGenerateReportAi}
              disabled={isGeneratingAi}
              id="generate-ai-report-section-btn"
            >
              <Sparkles size={15} />
              {isGeneratingAi
                ? lang === 'ru'
                  ? 'Генерация заключения Gemini...'
                  : 'Generating Gemini Verdict...'
                : lang === 'ru'
                ? 'Сгенерировать ИИ-заключение (Gemini)'
                : 'Generate Gemini AI Executive Verdict'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDownloadMarkdown}
              id="export-markdown-report-btn"
            >
              <Download size={15} />
              {lang === 'ru' ? 'Скачать отчет (.MD)' : 'Download Report (.MD)'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDownloadCSVSchedule}
              id="export-csv-schedule-btn"
            >
              <Download size={15} />
              {lang === 'ru' ? 'Таблица часов (.CSV)' : 'Export Hours (.CSV)'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
              id="print-report-btn"
            >
              <Printer size={15} />
              {lang === 'ru' ? 'Печать / PDF' : 'Print / Save PDF'}
            </button>
          </div>
        </div>

        <div
          className="panel-body"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'var(--bg-subtle)'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeTopics}
                onChange={(e) => setIncludeTopics(e.target.checked)}
              />
              {lang === 'ru' ? 'Диагностика сложных тем' : 'Include Topic Diagnostics'}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeTextbooks}
                onChange={(e) => setIncludeTextbooks(e.target.checked)}
              />
              {lang === 'ru' ? 'Рейтинг учебников' : 'Include Textbook Benchmark'}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeHoursPlan}
                onChange={(e) => setIncludeHoursPlan(e.target.checked)}
              />
              {lang === 'ru' ? 'План перераспределения часов' : 'Include Hours Reallocation Table'}
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {lang === 'ru' ? 'Подготовлено:' : 'Prepared By:'}
            </span>
            <input
              type="text"
              className="ai-text-input"
              style={{ padding: '5px 10px', fontSize: '12.5px', width: '240px' }}
              value={methodologistName}
              onChange={(e) => setMethodologistName(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Live Printable / Interactive Decision Dossier */}
      <div className="panel" style={{ padding: '28px 32px' }} id="printable-analytical-dossier">
        {/* Dossier Banner */}
        <div
          style={{
            borderBottom: '2px solid var(--text-primary)',
            paddingBottom: '18px',
            marginBottom: '22px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--accent-primary)',
                marginBottom: '4px'
              }}
            >
              CURRICULAB AI • OFFICIAL METHODOLOGICAL DOSSIER
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
              {lang === 'ru' ? subj.name_ru : subj.name_en} ({subj.code})
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {lang === 'ru' ? bundle.active_dataset.name_ru : bundle.active_dataset.name_en} •{' '}
              <strong>
                {bundle.active_dataset.is_synthetic
                  ? lang === 'ru'
                    ? 'Синтетические демонстрационные данные'
                    : 'Synthetic Demonstration Dataset'
                  : lang === 'ru'
                  ? 'Эмпирический пользовательский датасет'
                  : 'Uploaded Empirical Dataset'}
              </strong>
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            <div>
              <strong>{lang === 'ru' ? 'Комиссия:' : 'Board:'}</strong> {methodologistName}
            </div>
            <div>
              <strong>{lang === 'ru' ? 'Дата формирования:' : 'Generated:'}</strong>{' '}
              {new Date().toISOString().slice(0, 10)}
            </div>
            <div>
              <strong>{lang === 'ru' ? 'Выборка:' : 'Sample Size:'}</strong> {kpis.total_students}{' '}
              {lang === 'ru' ? 'учащихся' : 'students'} / {kpis.total_assessments}{' '}
              {lang === 'ru' ? 'оценок' : 'assessments'}
            </div>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="control-card">
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
              {dict.kpiMeanMastery}
            </div>
            <div className="mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
              {kpis.overall_mean_score}%{' '}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                (σ={kpis.overall_std_dev})
              </span>
            </div>
          </div>
          <div className="control-card">
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
              {dict.kpiStruggleRate}
            </div>
            <div
              className="mono"
              style={{
                fontSize: '22px',
                fontWeight: 700,
                marginTop: '4px',
                color: 'var(--status-critical)'
              }}
            >
              {kpis.struggle_rate_pct}%
            </div>
          </div>
          <div className="control-card">
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
              {dict.kpiBestTextbook}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>
              {lang === 'ru' ? kpis.top_textbook?.title_ru : kpis.top_textbook?.title_en}
            </div>
            <div className="mono" style={{ fontSize: '12px', color: 'var(--accent-teal)' }}>
              Efficacy: {kpis.top_textbook?.composite_efficacy}/100 (VA:{' '}
              {kpis.top_textbook?.value_added_delta >= 0 ? '+' : ''}
              {kpis.top_textbook?.value_added_delta}%)
            </div>
          </div>
          <div className="control-card">
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
              {dict.kpiOptimizationLift}
            </div>
            <div
              className="mono"
              style={{
                fontSize: '22px',
                fontWeight: 700,
                marginTop: '4px',
                color: 'var(--status-success)'
              }}
            >
              +{opt.summary.projected_subject_gain}%{' '}
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                ({opt.summary.total_hours_shifted}h shifted)
              </span>
            </div>
          </div>
        </div>

        {/* AI Executive Interpretation Section */}
        <div style={{ marginBottom: '26px' }}>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={17} color="var(--accent-primary)" />
            {lang === 'ru'
              ? '1. Экспертное аналитическое заключение Gemini AI'
              : '1. Gemini AI Methodological Verdict & Synthesis'}
          </h3>

          {savedAiSections?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {savedAiSections.map((sec, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '10px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                      marginBottom: '8px'
                    }}
                  >
                    VERIFIED GEMINI INSIGHT • MODEL: {sec.modelUsed || 'gemini-3-flash-preview'}
                  </div>
                  <MarkdownRenderer content={sec.content} />
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'var(--bg-subtle)',
                border: '1px dashed var(--border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {lang === 'ru'
                  ? 'Нажмите «Сгенерировать ИИ-заключение (Gemini)», чтобы добавить развернутый текстовый анализ реальных метрик в этот отчет.'
                  : 'Click "Generate Gemini AI Executive Verdict" above to synthesize a complete methodological narrative from the current metrics.'}
              </span>
              <button
                className="btn btn-primary btn-sm no-print"
                onClick={onGenerateReportAi}
                disabled={isGeneratingAi}
              >
                <Sparkles size={14} />
                {lang === 'ru' ? 'Сгенерировать через Gemini' : 'Generate with Gemini'}
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Topic Diagnosis */}
        {includeTopics && (
          <div style={{ marginBottom: '26px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={17} color="var(--status-critical)" />
              {lang === 'ru'
                ? '2. Диагностика усвоения и когнитивной сложности тем'
                : '2. Curriculum Topic Psychometrics & Learning Bottlenecks'}
            </h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{lang === 'ru' ? 'Код' : 'Code'}</th>
                    <th>{lang === 'ru' ? 'Тема программы' : 'Curriculum Topic'}</th>
                    <th>{lang === 'ru' ? 'Средний балл' : 'Mean Score'}</th>
                    <th>{lang === 'ru' ? 'Риск (<55%)' : 'Struggle (<55%)'}</th>
                    <th>{lang === 'ru' ? 'Индекс LDI' : 'Difficulty (LDI)'}</th>
                    <th>{lang === 'ru' ? 'Узкое место' : 'Primary Bottleneck'}</th>
                    <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.topic_analytics.map((t) => (
                    <tr key={t.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>{t.code}</td>
                      <td style={{ fontWeight: 600 }}>
                        {lang === 'ru' ? t.title_ru : t.title_en}
                      </td>
                      <td className="mono" style={{ fontWeight: 700 }}>{t.mean_score}%</td>
                      <td className="mono" style={{ color: t.struggle_rate >= 30 ? 'var(--status-critical)' : 'inherit' }}>
                        {t.struggle_rate}%
                      </td>
                      <td className="mono">{t.difficulty_index}</td>
                      <td>{lang === 'ru' ? t.primary_bottleneck_ru : t.primary_bottleneck_en}</td>
                      <td>
                        <span className={`status-badge ${t.status}`}>
                          {dict.statusLabels[t.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Textbook Benchmark */}
        {includeTextbooks && (
          <div style={{ marginBottom: '26px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Award size={17} color="var(--accent-teal)" />
              {lang === 'ru'
                ? '3. Сравнительная оценка эффективности учебников'
                : '3. Textbook Efficacy & Aptitude-Controlled Value-Added Benchmark'}
            </h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{lang === 'ru' ? 'Ранг' : 'Rank'}</th>
                    <th>{lang === 'ru' ? 'Учебник / Издательство' : 'Textbook & Publisher'}</th>
                    <th>{lang === 'ru' ? 'Индекс эффективности' : 'Composite Efficacy'}</th>
                    <th>{lang === 'ru' ? 'С учетом уровня (VA)' : 'Aptitude-Controlled'}</th>
                    <th>{lang === 'ru' ? 'Сложные темы' : 'Hard Topics Score'}</th>
                    <th>Cohen&apos;s d</th>
                    <th>{lang === 'ru' ? 'Лидер в темах' : 'Best For Topics'}</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.textbook_comparisons.map((tb, idx) => (
                    <tr key={tb.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>#{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>
                          {lang === 'ru' ? tb.title_ru : tb.title_en}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {tb.publisher} • {tb.authors} ({tb.year})
                        </div>
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {tb.composite_efficacy} / 100
                      </td>
                      <td className="mono">
                        <strong>{tb.aptitude_controlled_score}%</strong> (
                        {tb.value_added_delta >= 0 ? `+${tb.value_added_delta}%` : `${tb.value_added_delta}%`})
                      </td>
                      <td className="mono">{tb.hard_topics_adjusted}%</td>
                      <td className="mono">{tb.cohens_d}</td>
                      <td className="mono">
                        {tb.winning_topics.map((w) => w.code).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 4: Teaching-Hour Redistribution Schedule */}
        {includeHoursPlan && (
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Clock size={17} color="var(--accent-primary)" />
              {lang === 'ru'
                ? '4. Рекомендуемая сетка перераспределения учебных часов'
                : '4. Recommended Teaching-Hour Redistribution Schedule'}
            </h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{lang === 'ru' ? 'Тема' : 'Topic'}</th>
                    <th>{lang === 'ru' ? 'План (ч)' : 'Planned (h)'}</th>
                    <th>{lang === 'ru' ? 'Рекоменд. (ч)' : 'Recommended (h)'}</th>
                    <th>{lang === 'ru' ? 'Разница' : 'Delta'}</th>
                    <th>{lang === 'ru' ? 'Прогноз усвоения' : 'Projected Mastery'}</th>
                    <th>{lang === 'ru' ? 'Методическое обоснование' : 'Methodological Rationale'}</th>
                  </tr>
                </thead>
                <tbody>
                  {opt.recommendations.map((r) => (
                    <tr key={r.topic_id}>
                      <td>
                        <span className="mono" style={{ fontWeight: 700 }}>{r.topic_code}</span>{' '}
                        {lang === 'ru' ? r.title_ru : r.title_en}
                      </td>
                      <td className="mono">{r.planned_hours}h</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{r.recommended_hours}h</td>
                      <td
                        className="mono"
                        style={{
                          fontWeight: 700,
                          color:
                            r.delta_hours > 0
                              ? 'var(--status-critical)'
                              : r.delta_hours < 0
                              ? 'var(--status-success)'
                              : 'var(--text-muted)'
                        }}
                      >
                        {r.delta_hours > 0 ? `+${r.delta_hours}h` : `${r.delta_hours}h`}
                      </td>
                      <td className="mono">
                        {r.current_mastery}% → <strong>{r.projected_mastery}%</strong>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {lang === 'ru' ? r.rationale_ru : r.rationale_en}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
