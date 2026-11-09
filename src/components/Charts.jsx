import React, { useState } from 'react';

export function getScoreColor(score) {
  if (score < 50) {
    return {
      bg: 'hsl(350, 88%, 94%)',
      border: 'hsl(350, 75%, 80%)',
      text: 'hsl(350, 78%, 36%)',
      bar: 'hsl(350, 78%, 48%)'
    };
  }
  if (score < 64) {
    return {
      bg: 'hsl(38, 95%, 92%)',
      border: 'hsl(36, 82%, 76%)',
      text: 'hsl(30, 88%, 32%)',
      bar: 'hsl(32, 92%, 44%)'
    };
  }
  if (score < 79) {
    return {
      bg: 'hsl(210, 85%, 94%)',
      border: 'hsl(212, 70%, 80%)',
      text: 'hsl(216, 78%, 34%)',
      bar: 'hsl(220, 76%, 48%)'
    };
  }
  return {
    bg: 'hsl(152, 76%, 92%)',
    border: 'hsl(152, 62%, 75%)',
    text: 'hsl(154, 78%, 24%)',
    bar: 'hsl(154, 74%, 34%)'
  };
}

export function ClassTopicHeatmap({ heatmapMatrix, topics, lang, selectedTopicCode, onSelectTopic }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  if (!heatmapMatrix?.length || !topics?.length) return null;

  return (
    <div>
      <div className="table-wrap">
        <table className="heatmap-table" id="class-topic-heatmap">
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  fontSize: '11.5px',
                  color: 'var(--text-muted)',
                  minWidth: '190px'
                }}
              >
                {lang === 'ru' ? 'Класс / Учебник' : 'Class Cohort / Textbook'}
              </th>
              {topics.map((t) => (
                <th
                  key={t.id}
                  onClick={() => onSelectTopic && onSelectTopic(t.code)}
                  style={{
                    padding: '6px 6px',
                    fontSize: '11.5px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    color:
                      selectedTopicCode === t.code
                        ? 'var(--accent-primary)'
                        : 'var(--text-secondary)',
                    background:
                      selectedTopicCode === t.code
                        ? 'var(--accent-primary-soft)'
                        : 'transparent',
                    borderRadius: '6px'
                  }}
                  title={lang === 'ru' ? t.title_ru : t.title_en}
                >
                  <div>{t.code}</div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      maxWidth: '84px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      margin: '0 auto'
                    }}
                  >
                    {lang === 'ru' ? t.title_ru : t.title_en}
                  </div>
                </th>
              ))}
              <th
                style={{
                  padding: '6px 8px',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}
              >
                {lang === 'ru' ? 'Средний' : 'Cohort Avg'}
              </th>
            </tr>
          </thead>
          <tbody>
            {heatmapMatrix.map((row) => (
              <tr key={row.class_id}>
                <td
                  style={{
                    padding: '8px 10px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '6px'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '12.5px' }}>{row.class_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {lang === 'ru' ? row.textbook_title_ru : row.textbook_title_en}
                  </div>
                </td>
                {row.cells.map((cell) => {
                  const palette = getScoreColor(cell.mean_score);
                  const isSelected = selectedTopicCode === cell.topic_code;
                  return (
                    <td
                      key={cell.topic_id}
                      className="heatmap-cell"
                      onClick={() => onSelectTopic && onSelectTopic(cell.topic_code)}
                      onMouseEnter={() =>
                        setHoveredCell({
                          ...cell,
                          class_name: row.class_name,
                          textbook: lang === 'ru' ? row.textbook_title_ru : row.textbook_title_en
                        })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        background: palette.bg,
                        color: palette.text,
                        borderColor: isSelected ? 'var(--accent-primary)' : palette.border,
                        borderWidth: isSelected ? '2px' : '1px'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{cell.mean_score}%</div>
                      <div style={{ fontSize: '10px', opacity: 0.85 }}>
                        {cell.struggle_rate > 0
                          ? `${cell.struggle_count}/${cell.student_count} <55%`
                          : '0 <55%'}
                      </div>
                    </td>
                  );
                })}
                <td
                  className="heatmap-cell"
                  style={{
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontWeight: 700
                  }}
                >
                  {row.overall_mean}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interactive Cell Inspector Bar */}
      <div
        style={{
          marginTop: '12px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '12.5px'
        }}
      >
        {hoveredCell ? (
          <div>
            <strong>{hoveredCell.class_name}</strong> ({hoveredCell.textbook}) •{' '}
            <span className="mono" style={{ fontWeight: 700 }}>
              [{hoveredCell.topic_code}]
            </span>{' '}
            {lang === 'ru' ? hoveredCell.topic_title_ru : hoveredCell.topic_title_en}:{' '}
            <strong className="mono">{hoveredCell.mean_score}%</strong> (
            {hoveredCell.delta_vs_subject >= 0 ? `+${hoveredCell.delta_vs_subject}%` : `${hoveredCell.delta_vs_subject}%`}{' '}
            {lang === 'ru' ? 'от среднего по предмету' : 'vs subject mean'}) •{' '}
            <span style={{ color: 'var(--status-critical)', fontWeight: 600 }}>
              {hoveredCell.struggle_count}/{hoveredCell.student_count} ({hoveredCell.struggle_rate}%){' '}
              {lang === 'ru' ? 'учеников в зоне риска (<55%)' : 'students struggling (<55%)'}
            </span>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru'
              ? 'Наведите курсор на ячейку тепловой карты для деталей или нажмите на тему для глубокой диагностики.'
              : 'Hover over any heatmap cell to inspect class-by-topic mastery & struggle rates, or click any cell to drill down.'}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: 'hsl(350, 78%, 48%)'
              }}
            />
            {'<50%'} ({lang === 'ru' ? 'Критично' : 'Critical'})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: 'hsl(32, 92%, 44%)'
              }}
            />
            {'50–64%'} ({lang === 'ru' ? 'Сложно' : 'Struggle'})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: 'hsl(220, 76%, 48%)'
              }}
            />
            {'65–79%'} ({lang === 'ru' ? 'Норма' : 'On Track'})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: 'hsl(154, 74%, 34%)'
              }}
            />
            {'≥80%'} ({lang === 'ru' ? 'Высокое' : 'Mastery'})
          </span>
        </div>
      </div>
    </div>
  );
}

export function HoursOptimizationSVGChart({ recommendations, lang, onSelectTopic }) {
  if (!recommendations?.length) return null;

  const maxHours = Math.max(
    ...recommendations.flatMap((r) => [r.planned_hours, r.recommended_hours]),
    18
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {recommendations.map((rec) => {
        const plannedPct = (rec.planned_hours / maxHours) * 100;
        const recPct = (rec.recommended_hours / maxHours) * 100;
        const isRecipient = rec.delta_hours > 0;
        const isDonor = rec.delta_hours < 0;

        return (
          <div
            key={rec.topic_id}
            onClick={() => onSelectTopic && onSelectTopic(rec.topic_code)}
            style={{
              padding: '11px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="mono"
                  style={{
                    fontWeight: 700,
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-subtle)'
                  }}
                >
                  {rec.topic_code}
                </span>
                <span style={{ fontWeight: 600, fontSize: '13.5px' }}>
                  {lang === 'ru' ? rec.title_ru : rec.title_en}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {lang === 'ru' ? 'Усвоение:' : 'Mastery:'}{' '}
                  <strong>{rec.current_mastery}%</strong> →{' '}
                  <strong style={{ color: 'var(--status-success)' }}>
                    {rec.projected_mastery}%
                  </strong>{' '}
                  ({rec.projected_mastery_delta >= 0 ? `+${rec.projected_mastery_delta}%` : `${rec.projected_mastery_delta}%`})
                </span>
                <span
                  className="mono"
                  style={{
                    padding: '2px 8px',
                    borderRadius: '5px',
                    fontWeight: 700,
                    fontSize: '12px',
                    background: isRecipient
                      ? 'var(--status-critical-bg)'
                      : isDonor
                      ? 'var(--status-success-bg)'
                      : 'var(--bg-subtle)',
                    color: isRecipient
                      ? 'var(--status-critical)'
                      : isDonor
                      ? 'var(--status-success)'
                      : 'var(--text-secondary)'
                  }}
                >
                  {rec.planned_hours}h → {rec.recommended_hours}h (
                  {rec.delta_hours > 0 ? `+${rec.delta_hours}h` : `${rec.delta_hours}h`})
                </span>
              </div>
            </div>

            {/* Dual Bar: Planned vs Recommended */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="mono"
                  style={{ width: '92px', fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  {lang === 'ru' ? 'План (База):' : 'Planned:'} {rec.planned_hours}h
                </span>
                <div className="progress-track" style={{ height: '8px' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${plannedPct}%`,
                      background: 'hsl(215, 22%, 68%)'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="mono"
                  style={{
                    width: '92px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  {lang === 'ru' ? 'Рекоменд.:' : 'Optimized:'} {rec.recommended_hours}h
                </span>
                <div className="progress-track" style={{ height: '10px' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${recPct}%`,
                      background: isRecipient
                        ? 'var(--accent-primary)'
                        : isDonor
                        ? 'var(--accent-teal)'
                        : 'hsl(215, 25%, 52%)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TextbookMultiDimensionChart({ textbooks, lang }) {
  if (!textbooks?.length) return null;

  const dimensions = [
    {
      key: 'composite_efficacy',
      label_en: 'Composite Efficacy Index',
      label_ru: 'Интегральный индекс эффективности'
    },
    {
      key: 'aptitude_controlled_score',
      label_en: 'Aptitude-Controlled Mastery',
      label_ru: 'Усвоение (с учетом уровня класса)'
    },
    {
      key: 'hard_topics_adjusted',
      label_en: 'Hard-Topics Efficacy',
      label_ru: 'Результативность по сложным темам'
    },
    {
      key: 'coverage_index',
      label_en: 'Curriculum Coverage %',
      label_ru: 'Полнота покрытия ГОСО %'
    },
    {
      key: 'practice_density',
      label_en: 'Practice Problem Density',
      label_ru: 'Плотность практических задач'
    },
    {
      key: 'readability_score',
      label_en: 'Pedagogical Clarity & Visuals',
      label_ru: 'Доступность и визуализация'
    }
  ];

  const colors = [
    'hsl(224, 76%, 46%)',
    'hsl(173, 78%, 31%)',
    'hsl(32, 90%, 44%)',
    'hsl(350, 74%, 48%)'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
        {textbooks.map((tb, idx) => (
          <div
            key={tb.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              fontWeight: 600
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: colors[idx % colors.length]
              }}
            />
            <span>{lang === 'ru' ? tb.title_ru : tb.title_en}</span>
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
              ({tb.code})
            </span>
          </div>
        ))}
      </div>

      {/* Grouped Comparison Bars per Dimension */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '14px' }}>
        {dimensions.map((dim) => (
          <div
            key={dim.key}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '10px'
              }}
            >
              {lang === 'ru' ? dim.label_ru : dim.label_en}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {textbooks.map((tb, idx) => {
                const val = Number(tb[dim.key] || 0);
                return (
                  <div key={tb.id}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11.5px',
                        marginBottom: '3px'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{tb.publisher}</span>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {val}%
                      </span>
                    </div>
                    <div
                      className="progress-track"
                      style={{ height: '8px', background: '#e2e8f0' }}
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, Math.max(5, val))}%`,
                          background: colors[idx % colors.length]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
