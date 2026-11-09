import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  FileText,
  BookOpen,
  Clock,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer.jsx';

export function AiAssistantPanel({
  bundle,
  lang,
  messages,
  setMessages,
  isGenerating,
  onSendChat,
  onRunStructuredAnalysis,
  onSaveToReport,
  isDrawer = false,
  onCloseDrawer
}) {
  const [inputText, setInputText] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const text = inputText.trim();
    setInputText('');
    onSendChat(text);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const hardestTopic = bundle?.topic_analytics
    ? [...bundle.topic_analytics].sort((a, b) => b.difficulty_index - a.difficulty_index)[0]
    : null;

  const quickQuestions =
    lang === 'ru'
      ? [
          `Почему ученики испытывают трудности в теме ${hardestTopic?.code || ''} и как это исправить?`,
          'Какой учебник показывает лучший результат после поправки на исходный уровень классов?',
          'За счет каких тем безопасно выделить дополнительные часы без потери качества?',
          'Какие темы создают наибольший риск для последующих разделов программы?'
        ]
      : [
          `Why are students struggling with ${hardestTopic?.code || 'the hardest topic'} and how should we remediate it?`,
          'Which textbook has the highest true value-added effect after controlling for class aptitude?',
          'Which high-mastery topics can safely donate teaching hours without hurting student outcomes?',
          'Where are the highest prerequisite ripple risks in this subject curriculum?'
        ];

  return (
    <div
      className={isDrawer ? 'ai-drawer' : 'panel'}
      style={!isDrawer ? { minHeight: '680px', display: 'flex', flexDirection: 'column' } : undefined}
    >
      {/* Header */}
      <div
        className="panel-header"
        style={{
          background: 'var(--bg-sidebar)',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Sparkles size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
              {lang === 'ru'
                ? 'CurricuLab AI — Интеллектуальный методист (Google Gemini)'
                : 'CurricuLab AI — Gemini Methodologist Co-Pilot'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'hsl(215, 20%, 74%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="status-dot" />
              <span>
                {lang === 'ru' ? 'Контекст:' : 'Grounded in:'}{' '}
                {lang === 'ru' ? bundle?.active_subject?.name_ru : bundle?.active_subject?.name_en} (
                {bundle?.kpis?.total_assessments} {lang === 'ru' ? 'оценок' : 'assessments'})
              </span>
            </div>
          </div>
        </div>

        {isDrawer && onCloseDrawer && (
          <button
            className="btn btn-sm"
            onClick={onCloseDrawer}
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            id="close-ai-drawer-btn"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 1-Click Methodological Deep-Dive Bar */}
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {lang === 'ru' ? 'Быстрый ИИ-анализ:' : '1-Click Gemini Actions:'}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={isGenerating}
          onClick={() => onRunStructuredAnalysis('topic_diagnosis', hardestTopic?.code)}
          id="ai-btn-diagnose-topic"
        >
          <AlertTriangle size={13} color="var(--status-critical)" />
          {lang === 'ru'
            ? `Диагностика [${hardestTopic?.code}]`
            : `Diagnose Gap [${hardestTopic?.code}]`}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={isGenerating}
          onClick={() => onRunStructuredAnalysis('textbook_comparison')}
          id="ai-btn-compare-textbooks"
        >
          <BookOpen size={13} color="var(--accent-primary)" />
          {lang === 'ru' ? 'Вердикт по учебникам' : 'Compare Textbooks'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={isGenerating}
          onClick={() => onRunStructuredAnalysis('optimization_memo')}
          id="ai-btn-optimization-memo"
        >
          <Clock size={13} color="var(--accent-teal)" />
          {lang === 'ru' ? 'Обоснование часов УМО' : 'Hours Reallocation Memo'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={isGenerating}
          onClick={() => onRunStructuredAnalysis('executive_summary')}
          id="ai-btn-exec-summary"
        >
          <FileText size={13} />
          {lang === 'ru' ? 'Сводное резюме' : 'Executive Report'}
        </button>
      </div>

      {/* Messages Stream */}
      <div className="ai-messages-area">
        {messages.map((m, idx) => (
          <div key={idx} className={`ai-bubble ${m.role}`}>
            {m.role === 'assistant' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '11.5px',
                  color: 'var(--text-muted)'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  <Bot size={14} />
                  Gemini AI Methodologist
                  {m.modelUsed && (
                    <span className="mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      ({m.modelUsed})
                    </span>
                  )}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                    onClick={() => handleCopy(m.content, idx)}
                  >
                    {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                    {copiedIdx === idx
                      ? lang === 'ru'
                        ? 'Скопировано'
                        : 'Copied'
                      : lang === 'ru'
                      ? 'Копировать'
                      : 'Copy'}
                  </button>
                  {onSaveToReport && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--accent-teal)' }}
                      onClick={() => onSaveToReport(m.content)}
                    >
                      <FileText size={12} />
                      {lang === 'ru' ? 'В отчет' : 'Add to Report'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {m.role === 'assistant' ? (
              <MarkdownRenderer content={m.content} />
            ) : (
              <div>{m.content}</div>
            )}
          </div>
        ))}

        {isGenerating && (
          <div className="ai-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={16} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {lang === 'ru'
                ? 'Gemini AI анализирует статистические показатели вашей учебной программы...'
                : 'Gemini AI is analyzing your live curriculum statistics & textbook efficacy metrics...'}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested Question Chips */}
      <div className="prompt-chips">
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            className="prompt-chip"
            disabled={isGenerating}
            onClick={() => onSendChat(q)}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Input Form */}
      <form className="ai-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          className="ai-text-input"
          id="gemini-chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isGenerating}
          placeholder={
            lang === 'ru'
              ? 'Задайте вопрос по темам, учебникам, распределению часов или классам...'
              : 'Ask Gemini about struggling topics, textbook comparisons, or hour allocations...'
          }
        />
        <button
          type="submit"
          className="btn btn-primary"
          id="gemini-chat-submit-btn"
          disabled={isGenerating || !inputText.trim()}
        >
          <Send size={15} />
          {lang === 'ru' ? 'Отправить' : 'Send'}
        </button>
      </form>
    </div>
  );
}
