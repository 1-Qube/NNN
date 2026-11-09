import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  BookOpen,
  Clock,
  Users,
  Sparkles,
  FileText,
  Database,
  CheckCircle2,
  ArrowRight,
  Sliders,
  Award,
  Search,
  RotateCcw,
  Save
} from 'lucide-react';
import { T } from './i18n.js';
import {
  ClassTopicHeatmap,
  HoursOptimizationSVGChart,
  TextbookMultiDimensionChart,
  getScoreColor
} from './components/Charts.jsx';
import { AiAssistantPanel } from './components/AiAssistant.jsx';
import { DatasetManagerView } from './components/DatasetManagerView.jsx';
import { ReportBuilderView } from './components/ReportBuilderView.jsx';
import { MarkdownRenderer } from './components/MarkdownRenderer.jsx';
import {
  getBrowserAnalyticsBundle,
  saveBrowserHourOverrides,
  resetBrowserHourOverrides,
  buildStructuredMethodologicalPrompt,
  callBrowserGemini
} from './services/browserEngine.js';

export default function App() {
  const [lang, setLang] = useState('ru'); // Default RU as shown on the Zhambyl Hub Hackathon case card, with 1-click EN toggle
  const [activeTab, setActiveTab] = useState('dashboard');

  // Filter & Optimization State
  const [datasetId, setDatasetId] = useState('DS-SYNTHETIC-DEMO');
  const [subjectId, setSubjectId] = useState('SUB-MATH-9');
  const [classId, setClassId] = useState('ALL');
  const [textbookId, setTextbookId] = useState('ALL');

  const [optStrategy, setOptStrategy] = useState('balanced');
  const [optMaxChangePct, setOptMaxChangePct] = useState(35);
  const [optBudgetDelta, setOptBudgetDelta] = useState(0);

  // Data Bundle State
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopicCode, setSelectedTopicCode] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentTierFilter, setStudentTierFilter] = useState('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Custom Hour Overrides in Optimizer Tab
  const [customHoursMap, setCustomHoursMap] = useState({});
  const [saveToast, setSaveToast] = useState(null);

  // Gemini AI State
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      role: 'assistant',
      modelUsed: 'gemini-3-flash-preview',
      content:
        'Здравствуйте! Я **CurricuLab AI** — интеллектуальный ассистент методиста на базе **Google Gemini**.\n\nЯ подключен к реальному статистическому движку платформы. Выберите любой предмет, класс, учебник или тему программы — я проанализирую когнитивные причины пробелов в знаниях, сравню эффективность учебников с учетом уровня классов и обосную оптимальное перераспределение учебных часов.\n\n*(Switch to **EN** in the top-right corner at any time for full English interface & AI responses.)*'
    }
  ]);
  const [topicDiagnosisCache, setTopicDiagnosisCache] = useState({});
  const [savedReportAiSections, setSavedReportAiSections] = useState([]);

  const dict = T[lang] || T.en;

  const fetchAnalytics = useCallback(
    async (overrides = {}) => {
      setLoading(true);
      try {
        const ds = overrides.datasetId ?? datasetId;
        const sub = overrides.subjectId ?? subjectId;
        const cls = overrides.classId ?? classId;
        const tb = overrides.textbookId ?? textbookId;
        const strat = overrides.strategy ?? optStrategy;
        const maxPct = overrides.maxChangePct ?? optMaxChangePct;
        const bDelta = overrides.budgetDeltaHours ?? optBudgetDelta;

        let data = null;
        try {
          const params = new URLSearchParams({
            datasetId: ds,
            ...(sub ? { subjectId: sub } : {}),
            classId: cls,
            textbookId: tb,
            strategy: strat,
            maxChangePct: String(maxPct),
            budgetDeltaHours: String(bDelta)
          });
          const res = await fetch(`/api/analytics?${params.toString()}`);
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            data = await res.json();
          }
        } catch {}

        if (!data) {
          data = getBrowserAnalyticsBundle({
            datasetId: ds,
            subjectId: sub,
            classId: cls,
            textbookId: tb,
            optimizationParams: {
              strategy: strat,
              maxChangePct: Number(maxPct),
              budgetDeltaHours: Number(bDelta)
            }
          });
        }

        setBundle(data);
        setSubjectId(data.active_subject.id);

        if (
          !selectedTopicCode ||
          !data.topic_analytics.some((t) => t.code === selectedTopicCode)
        ) {
          const hardest = [...data.topic_analytics].sort(
            (a, b) => b.difficulty_index - a.difficulty_index
          )[0];
          setSelectedTopicCode(hardest?.code || data.topic_analytics[0]?.code);
        }

        const nextHours = {};
        data.optimization_plan.recommendations.forEach((r) => {
          nextHours[r.topic_id] = r.recommended_hours;
        });
        setCustomHoursMap(nextHours);
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [
      datasetId,
      subjectId,
      classId,
      textbookId,
      optStrategy,
      optMaxChangePct,
      optBudgetDelta,
      selectedTopicCode
    ]
  );

  useEffect(() => {
    fetchAnalytics();
  }, [datasetId, subjectId, classId, textbookId, optStrategy, optMaxChangePct, optBudgetDelta]);

  const handleSubjectChange = (newSubId) => {
    setSubjectId(newSubId);
    setClassId('ALL');
    setTextbookId('ALL');
    setSelectedTopicCode(null);
    setSelectedStudentId(null);
  };

  const handleDatasetSwitch = (newDsId) => {
    setDatasetId(newDsId);
    setSubjectId(null);
    setClassId('ALL');
    setTextbookId('ALL');
    setSelectedTopicCode(null);
  };

  // Gemini Chat Handler
  const handleSendAiChat = async (userMessage) => {
    const nextHistory = [...aiMessages, { role: 'user', content: userMessage }];
    setAiMessages(nextHistory);
    setIsGeneratingAi(true);

    try {
      let replyText = null;
      let modelUsed = null;
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId,
            subjectId,
            classId,
            textbookId,
            strategy: optStrategy,
            maxChangePct: optMaxChangePct,
            budgetDeltaHours: optBudgetDelta,
            message: userMessage,
            history: aiMessages.slice(-6),
            lang
          })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          replyText = data.reply;
          modelUsed = data.modelUsed;
        }
      } catch {}

      if (!replyText) {
        const browserRes = await callBrowserGemini({
          bundle,
          userPrompt: userMessage,
          history: aiMessages.slice(-6),
          lang
        });
        replyText = browserRes.text;
        modelUsed = browserRes.modelUsed;
      }

      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: replyText,
          modelUsed
        }
      ]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error communicating with Gemini API:** ${err.message}`
        }
      ]);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Gemini Structured Analysis Handler
  const handleRunStructuredAnalysis = async (
    analysisType,
    targetTopicCode = null,
    openDrawer = false
  ) => {
    if (openDrawer) setAiDrawerOpen(true);
    setIsGeneratingAi(true);

    const labelMap = {
      topic_diagnosis:
        lang === 'ru'
          ? `Запрос глубокой ИИ-диагностики темы [${targetTopicCode || selectedTopicCode}]`
          : `Run Gemini Deep Diagnosis on Topic [${targetTopicCode || selectedTopicCode}]`,
      textbook_comparison:
        lang === 'ru'
          ? 'Запрос сравнительной экспертизы эффективности учебников'
          : 'Run Gemini Textbook Efficacy & Value-Added Comparison',
      optimization_memo:
        lang === 'ru'
          ? 'Запрос аналитической записки УМО по перераспределению учебных часов'
          : 'Draft Official Methodological Board Hours Reallocation Memo',
      executive_summary:
        lang === 'ru'
          ? 'Запрос комплексного резюме по учебной программе'
          : 'Generate Executive Methodologist Curriculum Report'
    };

    setAiMessages((prev) => [
      ...prev,
      { role: 'user', content: labelMap[analysisType] || analysisType }
    ]);

    try {
      let analysisText = null;
      let modelUsed = null;
      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId,
            subjectId,
            classId,
            textbookId,
            strategy: optStrategy,
            maxChangePct: optMaxChangePct,
            budgetDeltaHours: optBudgetDelta,
            analysisType,
            targetTopicCode: targetTopicCode || selectedTopicCode,
            lang
          })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          analysisText = data.analysis;
          modelUsed = data.modelUsed;
        }
      } catch {}

      if (!analysisText) {
        const prompt = buildStructuredMethodologicalPrompt(
          bundle,
          analysisType,
          targetTopicCode || selectedTopicCode,
          lang
        );
        const browserRes = await callBrowserGemini({
          bundle,
          userPrompt: prompt,
          lang,
          mode: analysisType
        });
        analysisText = browserRes.text;
        modelUsed = browserRes.modelUsed;
      }

      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: analysisText,
          modelUsed
        }
      ]);

      if (analysisType === 'topic_diagnosis' && (targetTopicCode || selectedTopicCode)) {
        setTopicDiagnosisCache((prev) => ({
          ...prev,
          [targetTopicCode || selectedTopicCode]: {
            content: analysisText,
            modelUsed
          }
        }));
      }

      if (analysisType === 'executive_summary') {
        setSavedReportAiSections((prev) => [
          { content: analysisText, modelUsed },
          ...prev
        ]);
      }
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error:** ${err.message}`
        }
      ]);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveHoursToDatabase = async () => {
    if (!bundle) return;
    const allocations = Object.entries(customHoursMap).map(([topic_id, allocated_hours]) => ({
      topic_id,
      allocated_hours: Number(allocated_hours)
    }));

    try {
      let updatedBundle = null;
      try {
        const res = await fetch('/api/optimization/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId: bundle.active_dataset.id,
            subjectId: bundle.active_subject.id,
            allocations
          })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          updatedBundle = data.bundle;
        }
      } catch {}

      if (!updatedBundle) {
        updatedBundle = saveBrowserHourOverrides(
          bundle.active_dataset.id,
          bundle.active_subject.id,
          allocations
        );
      }

      setBundle(updatedBundle);
      setSaveToast(
        lang === 'ru'
          ? 'Новое распределение учебных часов сохранено!'
          : 'Updated teaching-hour schedule saved!'
      );
      setTimeout(() => setSaveToast(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  if (!bundle) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          gap: '12px'
        }}
      >
        <Sparkles size={22} color="var(--accent-primary)" />
        <span>Loading CurricuLab Psychometric & Optimization Engine...</span>
      </div>
    );
  }

  const activeSubject = bundle.active_subject;
  const kpis = bundle.kpis;
  const selectedTopic =
    bundle.topic_analytics.find((t) => t.code === selectedTopicCode) ||
    bundle.topic_analytics[0];

  const filteredStudents = bundle.students_summary.filter((st) => {
    if (studentTierFilter !== 'ALL' && st.risk_tier !== studentTierFilter) return false;
    if (
      studentSearch.trim() &&
      !st.full_name.toLowerCase().includes(studentSearch.toLowerCase()) &&
      !st.student_code.toLowerCase().includes(studentSearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const activeStudent =
    filteredStudents.find((s) => s.student_id === selectedStudentId) ||
    filteredStudents[0] ||
    null;

  return (
    <div className="app-layout">
      {/* Left Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-title">CurricuLab AI</div>
            <div className="brand-subtitle">{dict.brandSubtitle}</div>
          </div>
        </div>

        <div className="sidebar-section-label">{dict.navSectionCore}</div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            id="nav-tab-dashboard"
          >
            <span className="nav-item-left">
              <LayoutDashboard size={17} />
              <span>{dict.navDashboard}</span>
            </span>
          </button>

          <button
            className={`nav-item ${activeTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnostics')}
            id="nav-tab-diagnostics"
          >
            <span className="nav-item-left">
              <AlertTriangle size={17} />
              <span>{dict.navDiagnostics}</span>
            </span>
            <span className="nav-badge critical">{kpis.critical_topics_count}</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'textbooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('textbooks')}
            id="nav-tab-textbooks"
          >
            <span className="nav-item-left">
              <BookOpen size={17} />
              <span>{dict.navTextbooks}</span>
            </span>
            <span className="nav-badge">{bundle.textbooks.length}</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'optimizer' ? 'active' : ''}`}
            onClick={() => setActiveTab('optimizer')}
            id="nav-tab-optimizer"
          >
            <span className="nav-item-left">
              <Clock size={17} />
              <span>{dict.navOptimizer}</span>
            </span>
            <span className="nav-badge">
              {bundle.optimization_plan.summary.total_hours_shifted}h
            </span>
          </button>

          <button
            className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
            id="nav-tab-students"
          >
            <span className="nav-item-left">
              <Users size={17} />
              <span>{dict.navStudents}</span>
            </span>
            <span className="nav-badge">{kpis.total_students}</span>
          </button>
        </nav>

        <div className="sidebar-section-label">{dict.navSectionTools}</div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
            id="nav-tab-ai"
          >
            <span className="nav-item-left">
              <Sparkles size={17} />
              <span>{dict.navAiCopilot}</span>
            </span>
            <span className="nav-badge" style={{ background: 'var(--accent-teal)' }}>
              LIVE
            </span>
          </button>

          <button
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
            id="nav-tab-reports"
          >
            <span className="nav-item-left">
              <FileText size={17} />
              <span>{dict.navReports}</span>
            </span>
          </button>

          <button
            className={`nav-item ${activeTab === 'datasets' ? 'active' : ''}`}
            onClick={() => setActiveTab('datasets')}
            id="nav-tab-datasets"
          >
            <span className="nav-item-left">
              <Database size={17} />
              <span>{dict.navDatasets}</span>
            </span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="demo-status-box">
            <div className="demo-status-header">
              <span className="status-dot" />
              <span>Google Gemini API Live</span>
            </div>
            <div style={{ color: 'var(--text-on-dark-muted)', lineHeight: 1.4 }}>
              {lang === 'ru'
                ? 'Подключен реальный движок Gemini для интерпретации статистики УМО.'
                : 'Connected to live Gemini API grounded in verified SQLite metrics.'}
            </div>
          </div>

          <div className="demo-status-box">
            <div className="demo-status-header">
              <span className={`status-dot ${bundle.active_dataset.is_synthetic ? 'amber' : ''}`} />
              <span>
                {bundle.active_dataset.is_synthetic
                  ? dict.syntheticBadge
                  : dict.empiricalBadge}
              </span>
            </div>
            <div style={{ color: 'var(--text-on-dark-muted)', fontSize: '11px' }}>
              {bundle.active_dataset.record_count.toLocaleString()}{' '}
              {lang === 'ru' ? 'записей в SQLite' : 'records in SQLite'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Synthetic Data Identification Banner */}
        <div className="synthetic-banner">
          <div className="synthetic-banner-left">
            <span
              className={`synthetic-tag ${
                bundle.active_dataset.is_synthetic ? '' : 'empirical'
              }`}
            >
              {bundle.active_dataset.is_synthetic
                ? dict.syntheticBadge
                : dict.empiricalBadge}
            </span>
            <span>
              {bundle.active_dataset.is_synthetic
                ? dict.syntheticBannerText
                : dict.empiricalBannerText}
            </span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveTab('datasets')}
            id="banner-switch-dataset-btn"
          >
            <Database size={13} />
            {dict.uploadDatasetBtn}
          </button>
        </div>

        {/* Sticky Global Filter & Action Bar */}
        <header className="top-header">
          <div className="filter-toolbar">
            {/* Dataset Selector */}
            <div className="filter-group">
              <span className="filter-label">{dict.filterDataset}:</span>
              <select
                className="filter-select"
                id="global-dataset-select"
                value={bundle.active_dataset.id}
                onChange={(e) => handleDatasetSwitch(e.target.value)}
              >
                {bundle.datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.is_synthetic ? '[DEMO] ' : '[UPLOAD] '}
                    {lang === 'ru' ? d.name_ru : d.name_en}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Selector */}
            <div className="filter-group">
              <span className="filter-label">{dict.filterSubject}:</span>
              <select
                className="filter-select"
                id="global-subject-select"
                value={activeSubject.id}
                onChange={(e) => handleSubjectChange(e.target.value)}
              >
                {bundle.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {lang === 'ru' ? s.name_ru : s.name_en}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Cohort Selector */}
            <div className="filter-group">
              <span className="filter-label">{dict.filterClass}:</span>
              <select
                className="filter-select"
                id="global-class-select"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="ALL">{dict.allClasses}</option>
                {bundle.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.student_count})
                  </option>
                ))}
              </select>
            </div>

            {/* Textbook Filter */}
            <div className="filter-group">
              <span className="filter-label">{dict.filterTextbook}:</span>
              <select
                className="filter-select"
                id="global-textbook-select"
                value={textbookId}
                onChange={(e) => setTextbookId(e.target.value)}
              >
                <option value="ALL">{dict.allTextbooks}</option>
                {bundle.textbooks.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.code} — {tb.publisher}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="header-actions">
            {/* Language Switcher */}
            <div className="lang-switch" id="language-switcher">
              <button
                className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
                onClick={() => setLang('ru')}
              >
                RU
              </button>
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setAiDrawerOpen(true)}
              id="open-ai-drawer-btn"
            >
              <Sparkles size={15} />
              <span>{dict.askGeminiBtn}</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="page-content">
          {saveToast && (
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
              <span>{saveToast}</span>
            </div>
          )}

          {/* ==================== TAB 1: EXECUTIVE OVERVIEW DASHBOARD ==================== */}
          {activeTab === 'dashboard' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    {lang === 'ru' ? activeSubject.name_ru : activeSubject.name_en}
                  </h1>
                  <p className="page-subtitle">
                    {lang === 'ru'
                      ? activeSubject.description_ru
                      : activeSubject.description_en}{' '}
                    •{' '}
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {activeSubject.total_planned_hours}{' '}
                      {lang === 'ru' ? 'плановых часов в год' : 'planned annual hours'}
                    </span>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      handleRunStructuredAnalysis('executive_summary', null, true)
                    }
                    id="dashboard-ai-summary-btn"
                  >
                    <Sparkles size={15} color="var(--accent-primary)" />
                    {lang === 'ru'
                      ? 'ИИ-интерпретация предмета (Gemini)'
                      : 'Interpret Subject with Gemini AI'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('optimizer')}
                    id="dashboard-goto-optimizer-btn"
                  >
                    <Clock size={15} />
                    {lang === 'ru'
                      ? 'Оптимизировать учебные часы'
                      : 'Run Hour Optimizer'}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* 5 Executive KPI Cards */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>{dict.kpiMeanMastery}</span>
                    <span className="mono">{kpis.total_assessments} asm</span>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value">{kpis.overall_mean_score}%</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      ({dict.kpiMedianMastery}: {kpis.overall_median_score}%)
                    </span>
                  </div>
                  <div className="kpi-footnote">
                    <span>
                      σ = {kpis.overall_std_dev}% • {kpis.total_students}{' '}
                      {lang === 'ru' ? 'учащихся' : 'students'}
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>{dict.kpiStruggleRate}</span>
                    <AlertTriangle size={15} color="var(--status-critical)" />
                  </div>
                  <div className="kpi-value-row">
                    <span
                      className="kpi-value"
                      style={{ color: 'var(--status-critical)' }}
                    >
                      {kpis.struggle_rate_pct}%
                    </span>
                  </div>
                  <div className="kpi-footnote">
                    <span>
                      {lang === 'ru'
                        ? 'Доля оценок ниже порога 55%'
                        : 'Share of topic assessments scoring <55%'}
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>{dict.kpiCriticalTopics}</span>
                    <span className="mono">
                      {bundle.topic_analytics.length}{' '}
                      {lang === 'ru' ? 'тем всего' : 'topics total'}
                    </span>
                  </div>
                  <div className="kpi-value-row">
                    <span
                      className="kpi-value"
                      style={{ color: 'var(--status-critical)' }}
                    >
                      {kpis.critical_topics_count}
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--status-warning)', fontWeight: 600 }}>
                      + {kpis.moderate_topics_count}{' '}
                      {lang === 'ru' ? 'сложных' : 'moderate'}
                    </span>
                  </div>
                  <div className="kpi-footnote">
                    <span>
                      {kpis.surplus_topics_count}{' '}
                      {lang === 'ru'
                        ? 'тем с резервом часов (≥80%)'
                        : 'topics with surplus mastery (≥80%)'}
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>{dict.kpiBestTextbook}</span>
                    <Award size={15} color="var(--accent-teal)" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '14.5px', lineHeight: 1.25 }}>
                    {lang === 'ru'
                      ? kpis.top_textbook?.title_ru
                      : kpis.top_textbook?.title_en}
                  </div>
                  <div className="kpi-footnote">
                    <span className="mono" style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>
                      {kpis.top_textbook?.composite_efficacy}/100
                    </span>
                    <span>
                      (VA: {kpis.top_textbook?.value_added_delta >= 0 ? '+' : ''}
                      {kpis.top_textbook?.value_added_delta}%)
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>{dict.kpiOptimizationLift}</span>
                    <Clock size={15} color="var(--status-success)" />
                  </div>
                  <div className="kpi-value-row">
                    <span
                      className="kpi-value"
                      style={{ color: 'var(--status-success)' }}
                    >
                      +{kpis.projected_mastery_gain}%
                    </span>
                  </div>
                  <div className="kpi-footnote">
                    <span>
                      {lang === 'ru'
                        ? `Перераспределение ${kpis.hours_reallocated} ч внутри бюджета`
                        : `By reallocating ${kpis.hours_reallocated}h within budget`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Heatmap Matrix Panel */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      {lang === 'ru'
                        ? 'Тепловая матрица усвоения программы: Классы × Темы × Учебники'
                        : 'Curriculum Mastery & Struggle Heatmap: Class Cohorts × Topics × Textbooks'}
                    </div>
                    <div className="panel-subtitle">
                      {lang === 'ru'
                        ? 'Нажмите на любую ячейку или код темы для открытия детальной психометрической карточки'
                        : 'Click any cell or topic column to inspect sub-skill bottlenecks, common errors, and textbook differentials'}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('diagnostics')}
                  >
                    {lang === 'ru' ? 'Все темы подробно' : 'Deep-Dive All Topics'}
                    <ArrowRight size={13} />
                  </button>
                </div>
                <div className="panel-body">
                  <ClassTopicHeatmap
                    heatmapMatrix={bundle.heatmap_matrix}
                    topics={bundle.topic_analytics}
                    lang={lang}
                    selectedTopicCode={selectedTopic?.code}
                    onSelectTopic={(code) => {
                      setSelectedTopicCode(code);
                    }}
                  />
                </div>
              </div>

              {/* Split Panel: Topic Difficulty Ranking + Selected Topic Inspector */}
              <div className="panel-grid-2">
                {/* Left: Topic Mastery & Difficulty Bars */}
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="panel-title">
                        {lang === 'ru'
                          ? 'Рейтинг тем по усвоению и индексу трудности (LDI)'
                          : 'Topic Performance & Learning Difficulty Index (LDI)'}
                      </div>
                      <div className="panel-subtitle">
                        {lang === 'ru'
                          ? 'Выявление сложных разделов программы на основе реальных результатов тестирования'
                          : 'Automated identification of struggling curriculum units from student assessment distributions'}
                      </div>
                    </div>
                  </div>
                  <div
                    className="panel-body"
                    style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}
                  >
                    {bundle.topic_analytics.map((t) => {
                      const palette = getScoreColor(t.mean_score);
                      const isSelected = selectedTopic?.code === t.code;
                      return (
                        <div
                          key={t.id}
                          className={`topic-bar-row ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedTopicCode(t.code)}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span
                                className="mono"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'var(--bg-subtle)'
                                }}
                              >
                                {t.code}
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  lineHeight: 1.25
                                }}
                              >
                                {lang === 'ru' ? t.title_ru : t.title_en}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '3px'
                              }}
                            >
                              {lang === 'ru' ? 'План:' : 'Planned:'} {t.planned_hours}h • LDI:{' '}
                              <strong className="mono">{t.difficulty_index}</strong> •{' '}
                              {lang === 'ru' ? 'Риск (<55%):' : 'Struggle:'}{' '}
                              <strong style={{ color: 'var(--status-critical)' }}>
                                {t.struggle_rate}%
                              </strong>
                            </div>
                          </div>

                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '11.5px',
                                marginBottom: '4px'
                              }}
                            >
                              <span style={{ color: 'var(--text-muted)' }}>
                                IQR: {t.q25}% – {t.q75}%
                              </span>
                              <span className="mono" style={{ fontWeight: 700 }}>
                                {t.mean_score}%
                              </span>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${t.mean_score}%`,
                                  background: palette.bar
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span className={`status-badge ${t.status}`}>
                              {dict.statusLabels[t.status]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Selected Topic Diagnostic Card */}
                {selectedTopic && (
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <div className="panel-title">
                          <span className="mono" style={{ color: 'var(--accent-primary)' }}>
                            [{selectedTopic.code}]
                          </span>
                          <span>
                            {lang === 'ru'
                              ? 'Диагностический паспорт темы'
                              : 'Topic Diagnostic Inspector'}
                          </span>
                        </div>
                        <div className="panel-subtitle">
                          {lang === 'ru' ? selectedTopic.unit_ru : selectedTopic.unit_en}
                        </div>
                      </div>
                      <span className={`status-badge ${selectedTopic.status}`}>
                        {dict.statusLabels[selectedTopic.status]}
                      </span>
                    </div>

                    <div
                      className="panel-body"
                      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                    >
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>
                        {lang === 'ru' ? selectedTopic.title_ru : selectedTopic.title_en}
                      </h3>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '10px'
                        }}
                      >
                        <div className="control-card">
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {lang === 'ru' ? 'Средний балл' : 'Mean Score'}
                          </div>
                          <div className="mono" style={{ fontSize: '18px', fontWeight: 700 }}>
                            {selectedTopic.mean_score}%
                          </div>
                        </div>
                        <div className="control-card">
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {lang === 'ru' ? 'Доля <55%' : 'Struggle Rate'}
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: '18px',
                              fontWeight: 700,
                              color: 'var(--status-critical)'
                            }}
                          >
                            {selectedTopic.struggle_rate}%
                          </div>
                        </div>
                        <div className="control-card">
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {lang === 'ru' ? 'Индекс LDI' : 'Difficulty LDI'}
                          </div>
                          <div className="mono" style={{ fontSize: '18px', fontWeight: 700 }}>
                            {selectedTopic.difficulty_index}
                          </div>
                        </div>
                      </div>

                      {/* Sub-Skill Decomposition */}
                      <div
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
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>
                            {lang === 'ru'
                              ? 'Декомпозиция образовательных навыков:'
                              : 'Sub-Skill Cognitive Decomposition:'}
                          </span>
                          <span style={{ color: 'var(--status-critical)' }}>
                            {lang === 'ru' ? 'Узкое место:' : 'Bottleneck:'}{' '}
                            {lang === 'ru'
                              ? selectedTopic.primary_bottleneck_ru
                              : selectedTopic.primary_bottleneck_en}
                          </span>
                        </div>

                        {[
                          {
                            label:
                              lang === 'ru'
                                ? 'Концептуальное понимание (Теория)'
                                : 'Conceptual Understanding',
                            val: selectedTopic.conceptual_avg
                          },
                          {
                            label:
                              lang === 'ru'
                                ? 'Процедурный навык (Алгоритм)'
                                : 'Procedural Fluency',
                            val: selectedTopic.procedural_avg
                          },
                          {
                            label:
                              lang === 'ru'
                                ? 'Прикладной перенос и моделирование'
                                : 'Applied Problem-Solving',
                            val: selectedTopic.applied_avg
                          }
                        ].map((s, i) => (
                          <div key={i} style={{ marginBottom: '7px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '11.5px',
                                marginBottom: '2px'
                              }}
                            >
                              <span>{s.label}</span>
                              <span className="mono" style={{ fontWeight: 700 }}>
                                {s.val}%
                              </span>
                            </div>
                            <div className="progress-track" style={{ height: '7px' }}>
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${s.val}%`,
                                  background: getScoreColor(s.val).bar
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Typical Student Misconception */}
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'var(--status-critical-bg)',
                          border: '1px solid var(--status-critical-border)',
                          fontSize: '12.5px'
                        }}
                      >
                        <strong style={{ color: 'var(--status-critical)' }}>
                          {lang === 'ru'
                            ? 'Типичная ошибка учащихся:'
                            : 'Dominant Student Misconception:'}
                        </strong>{' '}
                        {lang === 'ru'
                          ? selectedTopic.common_error_ru || selectedTopic.common_error_en
                          : selectedTopic.common_error_en}
                      </div>

                      {/* Textbook Comparison for this specific topic */}
                      <div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            marginBottom: '6px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {lang === 'ru'
                            ? `Результативность учебников по теме [${selectedTopic.code}]:`
                            : `Textbook Performance on [${selectedTopic.code}]:`}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {selectedTopic.by_textbook.map((tb) => (
                            <div
                              key={tb.textbook_id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                background: 'var(--bg-subtle)',
                                fontSize: '12px'
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>
                                {lang === 'ru' ? tb.title_ru : tb.title_en}
                              </span>
                              <span className="mono">
                                Raw: <strong>{tb.mean_score}%</strong> | VA:{' '}
                                <strong style={{ color: 'var(--accent-primary)' }}>
                                  {tb.value_added_score}%
                                </strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          handleRunStructuredAnalysis(
                            'topic_diagnosis',
                            selectedTopic.code,
                            true
                          )
                        }
                        id="inspect-topic-gemini-btn"
                      >
                        <Sparkles size={15} />
                        {lang === 'ru'
                          ? `ИИ-диагностика темы [${selectedTopic.code}] через Gemini`
                          : `Diagnose [${selectedTopic.code}] with Gemini AI`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ==================== TAB 2: TOPIC LEARNING GAPS & DIAGNOSTICS ==================== */}
          {activeTab === 'diagnostics' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    {lang === 'ru'
                      ? 'Глубокая диагностика сложных тем учебной программы'
                      : 'Curriculum Topic Learning Gaps & Cognitive Bottleneck Analysis'}
                  </h1>
                  <p className="page-subtitle">
                    {lang === 'ru'
                      ? 'Психометрический анализ всех разделов программы: распределение учащихся по уровням усвоения, когнитивная нагрузка, пререквизиты и ИИ-рекомендации.'
                      : 'Psychometric evaluation across curriculum units: student proficiency tiers, cognitive load, prerequisite dependencies, and Gemini AI remediation plans.'}
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    handleRunStructuredAnalysis(
                      'topic_diagnosis',
                      selectedTopic?.code,
                      false
                    )
                  }
                  disabled={isGeneratingAi}
                >
                  <Sparkles size={15} />
                  {isGeneratingAi
                    ? lang === 'ru'
                      ? 'Анализ Gemini...'
                      : 'Running Gemini Diagnosis...'
                    : lang === 'ru'
                    ? `Запустить Gemini-разбор темы [${selectedTopic?.code}]`
                    : `Generate Gemini Remediation Plan for [${selectedTopic?.code}]`}
                </button>
              </div>

              {/* Full Psychometric Topic Table */}
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    {lang === 'ru'
                      ? 'Сводная психометрическая матрица разделов программы'
                      : 'Topic-by-Topic Psychometric & Mastery Matrix'}
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'ru' ? 'Код' : 'Code'}</th>
                        <th>{lang === 'ru' ? 'Тема учебной программы' : 'Curriculum Topic'}</th>
                        <th>{lang === 'ru' ? 'Часы (План)' : 'Planned Hours'}</th>
                        <th>{lang === 'ru' ? 'Когн. нагрузка' : 'Cognitive Load'}</th>
                        <th>{lang === 'ru' ? 'Средний / Медиана' : 'Mean / Median'}</th>
                        <th>{lang === 'ru' ? 'Доля <55%' : 'Struggle (<55%)'}</th>
                        <th>{lang === 'ru' ? 'Индекс LDI' : 'LDI Score'}</th>
                        <th>{lang === 'ru' ? 'Узкое место' : 'Bottleneck'}</th>
                        <th>{lang === 'ru' ? 'Лучший учебник' : 'Best Textbook'}</th>
                        <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
                        <th>{lang === 'ru' ? 'Действие' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundle.topic_analytics.map((t) => (
                        <tr
                          key={t.id}
                          className={selectedTopic?.code === t.code ? 'selected-row' : ''}
                          onClick={() => setSelectedTopicCode(t.code)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="mono" style={{ fontWeight: 700 }}>{t.code}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>
                              {lang === 'ru' ? t.title_ru : t.title_en}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {lang === 'ru' ? t.key_concepts_ru : t.key_concepts_en}
                            </div>
                          </td>
                          <td className="mono">{t.planned_hours}h</td>
                          <td className="mono">{t.cognitive_load} / 5.0</td>
                          <td className="mono">
                            <strong>{t.mean_score}%</strong> / {t.median_score}%
                          </td>
                          <td
                            className="mono"
                            style={{
                              fontWeight: 700,
                              color:
                                t.struggle_rate >= 30
                                  ? 'var(--status-critical)'
                                  : 'var(--text-primary)'
                            }}
                          >
                            {t.struggle_rate}% ({t.struggle_count})
                          </td>
                          <td className="mono" style={{ fontWeight: 700 }}>
                            {t.difficulty_index}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {lang === 'ru'
                              ? t.primary_bottleneck_ru
                              : t.primary_bottleneck_en}
                          </td>
                          <td className="mono" style={{ fontSize: '12px', color: 'var(--accent-teal)', fontWeight: 600 }}>
                            {t.best_textbook?.textbook_code} ({t.best_textbook?.value_added_score}%)
                          </td>
                          <td>
                            <span className={`status-badge ${t.status}`}>
                              {dict.statusLabels[t.status]}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTopicCode(t.code);
                                handleRunStructuredAnalysis('topic_diagnosis', t.code, false);
                              }}
                            >
                              <Sparkles size={12} color="var(--accent-primary)" />
                              AI
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inline Gemini Topic Remediation Card */}
              {selectedTopic && (
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="panel-title">
                        <Sparkles size={18} color="var(--accent-primary)" />
                        {lang === 'ru'
                          ? `ИИ-диагностика и поурочный план коррекции темы [${selectedTopic.code}]: ${selectedTopic.title_ru}`
                          : `Gemini AI Pedagogical Diagnosis & Remediation Protocol for [${selectedTopic.code}]: ${selectedTopic.title_en}`}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isGeneratingAi}
                      onClick={() =>
                        handleRunStructuredAnalysis(
                          'topic_diagnosis',
                          selectedTopic.code,
                          false
                        )
                      }
                    >
                      <Sparkles size={14} />
                      {lang === 'ru' ? 'Обновить анализ Gemini' : 'Run Gemini Analysis'}
                    </button>
                  </div>
                  <div className="panel-body">
                    {topicDiagnosisCache[selectedTopic.code] ? (
                      <MarkdownRenderer
                        content={topicDiagnosisCache[selectedTopic.code].content}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '18px',
                          background: 'var(--bg-subtle)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                            {lang === 'ru'
                              ? `Тема [${selectedTopic.code}] имеет индекс трудности LDI = ${selectedTopic.difficulty_index} и долю риска ${selectedTopic.struggle_rate}%.`
                              : `Topic [${selectedTopic.code}] has Learning Difficulty Index ${selectedTopic.difficulty_index} and ${selectedTopic.struggle_rate}% struggle rate.`}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {lang === 'ru'
                              ? 'Нажмите кнопку справа, чтобы Gemini AI проанализировал разрыв между концептуальным и прикладным усвоением и составил план коррекции.'
                              : 'Click the button to generate a real-time Gemini AI diagnostic report and remediation plan for this topic.'}
                          </div>
                        </div>
                        <button
                          className="btn btn-primary"
                          disabled={isGeneratingAi}
                          onClick={() =>
                            handleRunStructuredAnalysis(
                              'topic_diagnosis',
                              selectedTopic.code,
                              false
                            )
                          }
                        >
                          <Sparkles size={15} />
                          {lang === 'ru'
                            ? 'Сгенерировать ИИ-разбор'
                            : 'Generate Diagnosis with Gemini'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== TAB 3: TEXTBOOK EFFICACY BENCHMARK ==================== */}
          {activeTab === 'textbooks' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    {lang === 'ru'
                      ? 'Сравнительный анализ эффективности учебников (Value-Added Benchmark)'
                      : 'Textbook Efficacy & Aptitude-Controlled Value-Added Benchmark'}
                  </h1>
                  <p className="page-subtitle">
                    {lang === 'ru'
                      ? 'Объективное сравнение учебников на основе образовательных результатов учащихся с поправкой на исходный уровень классов, покрытия ГОСО и сложных тем.'
                      : 'Objective evaluation of competing textbooks controlling for baseline class aptitude, performance on high-difficulty topics, and curriculum coverage.'}
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    handleRunStructuredAnalysis('textbook_comparison', null, true)
                  }
                  id="textbook-ai-verdict-btn"
                >
                  <Sparkles size={15} />
                  {lang === 'ru'
                    ? 'Сравнить учебники через Gemini AI'
                    : 'Generate Gemini Textbook Verdict'}
                </button>
              </div>

              {/* Textbook Leaderboard Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '16px'
                }}
              >
                {bundle.textbook_comparisons.map((tb, idx) => (
                  <div
                    key={tb.id}
                    className="panel"
                    style={{
                      borderTop:
                        idx === 0
                          ? '4px solid var(--accent-primary)'
                          : '4px solid var(--border-strong)'
                    }}
                  >
                    <div className="panel-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="mono"
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background:
                                idx === 0
                                  ? 'var(--accent-primary)'
                                  : 'var(--bg-subtle)',
                              color: idx === 0 ? '#fff' : 'var(--text-primary)',
                              fontWeight: 700,
                              fontSize: '11.5px'
                            }}
                          >
                            #{idx + 1} {idx === 0 ? (lang === 'ru' ? 'ЛИДЕР' : 'TOP PICK') : ''}
                          </span>
                          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {tb.code}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: '16px',
                            marginTop: '6px'
                          }}
                        >
                          {lang === 'ru' ? tb.title_ru : tb.title_en}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {tb.publisher} • {tb.authors} ({tb.year})
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          className="mono"
                          style={{
                            fontSize: '24px',
                            fontWeight: 700,
                            color: 'var(--accent-primary)'
                          }}
                        >
                          {tb.composite_efficacy}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          EFFICACY / 100
                        </div>
                      </div>
                    </div>

                    <div
                      className="panel-body"
                      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                    >
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {lang === 'ru' ? tb.pedagogical_focus_ru : tb.pedagogical_focus_en}
                      </p>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px'
                        }}
                      >
                        <div className="control-card">
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {lang === 'ru'
                              ? 'Балл с учетом уровня (VA)'
                              : 'Aptitude-Controlled Mean'}
                          </div>
                          <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                            {tb.aptitude_controlled_score}%{' '}
                            <span
                              style={{
                                fontSize: '12px',
                                color:
                                  tb.value_added_delta >= 0
                                    ? 'var(--status-success)'
                                    : 'var(--status-critical)'
                              }}
                            >
                              ({tb.value_added_delta >= 0 ? `+${tb.value_added_delta}%` : `${tb.value_added_delta}%`})
                            </span>
                          </div>
                        </div>

                        <div className="control-card">
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {lang === 'ru'
                              ? 'Усвоение сложных тем'
                              : 'Hard Topics Mastery'}
                          </div>
                          <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                            {tb.hard_topics_adjusted}%{' '}
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              (d={tb.cohens_d})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '12px' }}>
                        <strong>
                          {lang === 'ru' ? 'Лидирует в темах:' : 'Wins Value-Added in Topics:'}
                        </strong>{' '}
                        {tb.winning_topics.length > 0 ? (
                          tb.winning_topics.map((w) => (
                            <span
                              key={w.code}
                              className="mono"
                              style={{
                                display: 'inline-block',
                                margin: '2px 4px 2px 0',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'var(--accent-teal-soft)',
                                color: 'var(--accent-teal)',
                                fontWeight: 700,
                                fontSize: '11px'
                              }}
                            >
                              {w.code}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>
                            {lang === 'ru'
                              ? 'Вспомогательный / базовый'
                              : 'Secondary across core topics'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Multi-Dimensional Textbook Visual Comparison */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      {lang === 'ru'
                        ? 'Многофакторное профилирование учебников по 6 параметрам'
                        : '6-Dimension Textbook Efficacy & Pedagogical Quality Profile'}
                    </div>
                  </div>
                </div>
                <div className="panel-body">
                  <TextbookMultiDimensionChart
                    textbooks={bundle.textbook_comparisons}
                    lang={lang}
                  />
                </div>
              </div>

              {/* Topic-by-Topic Textbook Matrix */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      {lang === 'ru'
                        ? 'Матрица эффективности учебников в разрезе каждой темы программы'
                        : 'Topic-by-Topic Textbook Mastery Comparison Matrix'}
                    </div>
                    <div className="panel-subtitle">
                      {lang === 'ru'
                        ? 'Позволяет методисту формировать гибридные рекомендации (базовый учебник + дополнительный задачник по западающим темам)'
                        : 'Enables methodologists to design hybrid curriculum recommendations (primary textbook + targeted supplementary chapters)'}
                    </div>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'ru' ? 'Код' : 'Code'}</th>
                        <th>{lang === 'ru' ? 'Тема программы' : 'Curriculum Topic'}</th>
                        {bundle.textbooks.map((tb) => (
                          <th key={tb.id}>
                            <div>{tb.publisher}</div>
                            <div className="mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              {tb.code} (Raw / VA)
                            </div>
                          </th>
                        ))}
                        <th>{lang === 'ru' ? 'Рекомендуемый учебник по теме' : 'Recommended Topic Leader'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundle.topic_analytics.map((topic) => (
                        <tr key={topic.id}>
                          <td className="mono" style={{ fontWeight: 700 }}>{topic.code}</td>
                          <td style={{ fontWeight: 600 }}>
                            {lang === 'ru' ? topic.title_ru : topic.title_en}
                          </td>
                          {bundle.textbooks.map((tb) => {
                            const cell = topic.by_textbook.find(
                              (x) => x.textbook_id === tb.id
                            );
                            const isWinner =
                              topic.best_textbook?.textbook_id === tb.id;
                            return (
                              <td
                                key={tb.id}
                                className="mono"
                                style={{
                                  background: isWinner
                                    ? 'var(--status-success-bg)'
                                    : 'transparent',
                                  fontWeight: isWinner ? 700 : 500
                                }}
                              >
                                {cell ? (
                                  <>
                                    {cell.mean_score}% /{' '}
                                    <span style={{ color: 'var(--accent-primary)' }}>
                                      {cell.value_added_score}%
                                    </span>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          })}
                          <td>
                            <span
                              className="mono"
                              style={{
                                padding: '3px 8px',
                                borderRadius: '5px',
                                background: 'var(--accent-primary-soft)',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                fontSize: '11.5px'
                              }}
                            >
                              {topic.best_textbook?.textbook_code} (
                              {lang === 'ru'
                                ? topic.best_textbook?.title_ru
                                : topic.best_textbook?.title_en}
                              )
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB 4: CURRICULUM TEACHING-HOUR OPTIMIZER ==================== */}
          {activeTab === 'optimizer' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    {lang === 'ru'
                      ? 'Алгоритм оптимизации и перераспределения учебных часов'
                      : 'Algorithmic Teaching-Hour Redistribution & Optimization Engine'}
                  </h1>
                  <p className="page-subtitle">
                    {lang === 'ru'
                      ? 'Математическое перераспределение часового фонда от тем с избыточным усвоением (≥80%) к темам с высоким индексом трудности LDI без превышения годового бюджета.'
                      : 'Constrained mathematical optimization shifting hours from high-mastery donor units to high-difficulty bottleneck units while preserving annual budget guardrails.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      handleRunStructuredAnalysis('optimization_memo', null, true)
                    }
                    id="optimizer-ai-memo-btn"
                  >
                    <Sparkles size={15} color="var(--accent-primary)" />
                    {lang === 'ru'
                      ? 'Сформировать обоснование для УМО (Gemini)'
                      : 'Draft Board Justification Memo (Gemini)'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveHoursToDatabase}
                    id="save-hour-allocations-btn"
                  >
                    <Save size={15} />
                    {lang === 'ru'
                      ? 'Утвердить и сохранить сетку часов'
                      : 'Commit Schedule to Database'}
                  </button>
                </div>
              </div>

              {/* Optimization Algorithm Parameters & Interactive Controls */}
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <Sliders size={18} color="var(--accent-primary)" />
                    {lang === 'ru'
                      ? 'Параметры алгоритма оптимизации учебного плана'
                      : 'Optimization Algorithm Strategy & Regulatory Guardrails'}
                  </div>
                </div>
                <div
                  className="panel-body"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '16px'
                  }}
                >
                  {/* Strategy Selector */}
                  <div className="control-card">
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        marginBottom: '6px'
                      }}
                    >
                      {lang === 'ru'
                        ? 'Целевая функция оптимизации:'
                        : 'Optimization Objective Function:'}
                    </label>
                    <select
                      className="ai-text-input"
                      style={{ width: '100%', background: '#fff' }}
                      value={optStrategy}
                      onChange={(e) => setOptStrategy(e.target.value)}
                      id="optimizer-strategy-select"
                    >
                      <option value="balanced">
                        {lang === 'ru'
                          ? 'Сбалансированная (LDI + Когнитивная нагрузка + Риск)'
                          : 'Balanced Psychometric & Cognitive Alignment'}
                      </option>
                      <option value="remedial_focus">
                        {lang === 'ru'
                          ? 'Ликвидация отставания (Максимум на группы риска <55%)'
                          : 'Remedial Focus (Maximize Lifting At-Risk Cohort <55%)'}
                      </option>
                      <option value="prerequisite_shield">
                        {lang === 'ru'
                          ? 'Защита базовых пререквизитов (Фундаментальные темы)'
                          : 'Prerequisite Shield (Prioritize Upstream Foundation Units)'}
                      </option>
                    </select>
                  </div>

                  {/* Max Change Guardrail Slider */}
                  <div className="control-card">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 700,
                        marginBottom: '6px'
                      }}
                    >
                      <span>
                        {lang === 'ru'
                          ? 'Макс. изменение часов по одной теме:'
                          : 'Max Hour Shift Per Topic Guardrail:'}
                      </span>
                      <span className="mono" style={{ color: 'var(--accent-primary)' }}>
                        ±{optMaxChangePct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      className="range-slider"
                      min={15}
                      max={50}
                      step={5}
                      value={optMaxChangePct}
                      onChange={(e) => setOptMaxChangePct(Number(e.target.value))}
                      id="optimizer-max-pct-slider"
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <span>±15% (Conservative)</span>
                      <span>±35% (Standard)</span>
                      <span>±50% (Aggressive)</span>
                    </div>
                  </div>

                  {/* Annual Hour Budget Delta */}
                  <div className="control-card">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 700,
                        marginBottom: '6px'
                      }}
                    >
                      <span>
                        {lang === 'ru'
                          ? 'Резерв факультативных часов к годовому плану:'
                          : 'Elective / Remedial Budget Adjustment:'}
                      </span>
                      <span className="mono" style={{ color: 'var(--accent-teal)' }}>
                        {optBudgetDelta >= 0 ? `+${optBudgetDelta}h` : `${optBudgetDelta}h`} (
                        {bundle.optimization_plan.summary.recommended_total_hours}h total)
                      </span>
                    </div>
                    <input
                      type="range"
                      className="range-slider"
                      min={-6}
                      max={12}
                      step={2}
                      value={optBudgetDelta}
                      onChange={(e) => setOptBudgetDelta(Number(e.target.value))}
                      id="optimizer-budget-delta-slider"
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <span>-6h</span>
                      <span>0h (Zero-Sum ГОСО)</span>
                      <span>+12h (With Electives)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Impact Summary Strip */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>
                      {lang === 'ru' ? 'Годовой бюджет часов' : 'Annual Curriculum Budget'}
                    </span>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value">
                      {bundle.optimization_plan.summary.baseline_total_hours}h →{' '}
                      {bundle.optimization_plan.summary.recommended_total_hours}h
                    </span>
                  </div>
                  <div className="kpi-footnote">
                    {lang === 'ru'
                      ? `Перераспределено внутри программы: ${bundle.optimization_plan.summary.total_hours_shifted} ч`
                      : `${bundle.optimization_plan.summary.total_hours_shifted}h redistributed across units`}
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>
                      {lang === 'ru'
                        ? 'Прогноз среднего усвоения'
                        : 'Projected Subject Mastery'}
                    </span>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value" style={{ color: 'var(--status-success)' }}>
                      {bundle.optimization_plan.summary.current_subject_mastery}% →{' '}
                      {bundle.optimization_plan.summary.projected_subject_mastery}%
                    </span>
                  </div>
                  <div className="kpi-footnote">
                    <strong style={{ color: 'var(--status-success)' }}>
                      +{bundle.optimization_plan.summary.projected_subject_gain}%
                    </strong>{' '}
                    {lang === 'ru' ? 'ожидаемый прирост' : 'expected mastery gain'}
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span>
                      {lang === 'ru'
                        ? 'Снижение доли неуспевающих (<55%)'
                        : 'Projected Struggle Rate Reduction'}
                    </span>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-value" style={{ color: 'var(--accent-teal)' }}>
                      {bundle.optimization_plan.summary.current_struggle_rate}% →{' '}
                      {bundle.optimization_plan.summary.projected_struggle_rate}%
                    </span>
                  </div>
                  <div className="kpi-footnote">
                    <strong style={{ color: 'var(--accent-teal)' }}>
                      -{bundle.optimization_plan.summary.projected_struggle_reduction}%
                    </strong>{' '}
                    {lang === 'ru'
                      ? 'сокращение группы риска'
                      : 'reduction in struggling students'}
                  </div>
                </div>
              </div>

              {/* Visual Chart + Interactive Table */}
              <div className="panel-grid-2">
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      {lang === 'ru'
                        ? 'Диаграмма перераспределения часов: План vs Оптимизация'
                        : 'Visual Teaching-Hour Redistribution: Planned vs Optimized'}
                    </div>
                  </div>
                  <div className="panel-body">
                    <HoursOptimizationSVGChart
                      recommendations={bundle.optimization_plan.recommendations}
                      lang={lang}
                      onSelectTopic={(code) => setSelectedTopicCode(code)}
                    />
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="panel-title">
                        {lang === 'ru'
                          ? 'Интерактивная калибровка часов методистом'
                          : 'Methodologist Manual Hour Calibration & Rationale'}
                      </div>
                      <div className="panel-subtitle">
                        {lang === 'ru'
                          ? 'Вы можете скорректировать часы вручную перед сохранением в БД'
                          : 'Fine-tune recommended hours per topic before committing to the database'}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const resetMap = {};
                        bundle.optimization_plan.recommendations.forEach((r) => {
                          resetMap[r.topic_id] = r.recommended_hours;
                        });
                        setCustomHoursMap(resetMap);
                      }}
                    >
                      <RotateCcw size={13} />
                      {lang === 'ru' ? 'К расчету ИИ' : 'Reset to AI Optimal'}
                    </button>
                  </div>
                  <div
                    className="panel-body"
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    {bundle.optimization_plan.recommendations.map((r) => {
                      const val =
                        customHoursMap[r.topic_id] !== undefined
                          ? customHoursMap[r.topic_id]
                          : r.recommended_hours;
                      const manualDelta = val - r.planned_hours;

                      return (
                        <div
                          key={r.topic_id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                              marginBottom: '6px'
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>
                              <span className="mono">[{r.topic_code}]</span>{' '}
                              {lang === 'ru' ? r.title_ru : r.title_en}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min={2}
                                max={30}
                                value={val}
                                onChange={(e) =>
                                  setCustomHoursMap((prev) => ({
                                    ...prev,
                                    [r.topic_id]: Number(e.target.value)
                                  }))
                                }
                                className="mono"
                                style={{
                                  width: '62px',
                                  padding: '4px 6px',
                                  borderRadius: '5px',
                                  border: '1px solid var(--border-strong)',
                                  fontWeight: 700,
                                  textAlign: 'center'
                                }}
                              />
                              <span className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>
                                h ({manualDelta >= 0 ? `+${manualDelta}h` : `${manualDelta}h`})
                              </span>
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {lang === 'ru' ? r.rationale_ru : r.rationale_en}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB 5: STUDENT PERFORMANCE & RISK EXPLORER ==================== */}
          {activeTab === 'students' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    {lang === 'ru'
                      ? 'Анализ индивидуальной успеваемости и групп риска учащихся'
                      : 'Student Performance Distribution & At-Risk Cohort Explorer'}
                  </h1>
                  <p className="page-subtitle">
                    {lang === 'ru'
                      ? 'Индивидуальные траектории учащихся по темам программы, выявление кандидатов на адресную педагогическую поддержку.'
                      : 'Granular student-level mastery trajectories across every curriculum topic to target early pedagogical interventions.'}
                  </p>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="panel">
                <div
                  className="panel-body"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                    <Search size={16} color="var(--text-muted)" />
                    <input
                      type="text"
                      className="ai-text-input"
                      placeholder={
                        lang === 'ru'
                          ? 'Поиск ученика по имени или коду (например, Alikhan или KZ-901)...'
                          : 'Search student by name or ID code...'
                      }
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      id="student-search-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'ALL', label: lang === 'ru' ? 'Все уровни' : 'All Tiers' },
                      {
                        id: 'Intervention Required',
                        label: lang === 'ru' ? 'Группа риска (<55%)' : 'Intervention Required (<55%)'
                      },
                      {
                        id: 'Developing',
                        label: lang === 'ru' ? 'Базовый (55–69%)' : 'Developing (55–69%)'
                      },
                      {
                        id: 'Proficient',
                        label: lang === 'ru' ? 'Достаточный (70–84%)' : 'Proficient (70–84%)'
                      },
                      {
                        id: 'Advanced',
                        label: lang === 'ru' ? 'Высокий (≥85%)' : 'Advanced (≥85%)'
                      }
                    ].map((tier) => (
                      <button
                        key={tier.id}
                        className={`btn btn-sm ${
                          studentTierFilter === tier.id ? 'btn-primary' : 'btn-secondary'
                        }`}
                        onClick={() => setStudentTierFilter(tier.id)}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel-grid-2">
                {/* Student Roster Table */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      {lang === 'ru'
                        ? `Список учащихся (${filteredStudents.length})`
                        : `Student Cohort Roster (${filteredStudents.length})`}
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '560px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{lang === 'ru' ? 'Код' : 'Code'}</th>
                          <th>{lang === 'ru' ? 'ФИО ученика' : 'Student Name'}</th>
                          <th>{lang === 'ru' ? 'Класс' : 'Class'}</th>
                          <th>{lang === 'ru' ? 'Учебник' : 'Textbook'}</th>
                          <th>{lang === 'ru' ? 'Средний балл' : 'Mean Score'}</th>
                          <th>{lang === 'ru' ? 'Слабых тем' : 'Weak Topics'}</th>
                          <th>{lang === 'ru' ? 'Статус' : 'Risk Tier'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((st) => (
                          <tr
                            key={st.student_id}
                            className={
                              activeStudent?.student_id === st.student_id
                                ? 'selected-row'
                                : ''
                            }
                            onClick={() => setSelectedStudentId(st.student_id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="mono" style={{ fontSize: '11.5px' }}>
                              {st.student_code}
                            </td>
                            <td style={{ fontWeight: 600 }}>{st.full_name}</td>
                            <td>{st.class_name}</td>
                            <td className="mono" style={{ fontSize: '11.5px' }}>
                              {st.textbook_code}
                            </td>
                            <td className="mono" style={{ fontWeight: 700 }}>
                              {st.mean_score}%
                            </td>
                            <td className="mono">{st.weak_topics_count}</td>
                            <td>
                              <span
                                className={`status-badge ${
                                  st.risk_tier === 'Intervention Required'
                                    ? 'CRITICAL_GAP'
                                    : st.risk_tier === 'Developing'
                                    ? 'MODERATE_STRUGGLE'
                                    : st.risk_tier === 'Advanced'
                                    ? 'SURPLUS_MASTERY'
                                    : 'ON_TRACK'
                                }`}
                              >
                                {st.risk_tier}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Individual Student Profile Card */}
                {activeStudent && (
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <div className="panel-title">
                          <span>{activeStudent.full_name}</span>
                          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            ({activeStudent.student_code})
                          </span>
                        </div>
                        <div className="panel-subtitle">
                          {activeStudent.class_name} • {lang === 'ru' ? 'Учебник:' : 'Textbook:'}{' '}
                          {activeStudent.textbook_code} •{' '}
                          {lang === 'ru' ? 'Посещаемость:' : 'Attendance:'}{' '}
                          {activeStudent.attendance_rate}%
                        </div>
                      </div>
                    </div>
                    <div
                      className="panel-body"
                      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>
                        {lang === 'ru'
                          ? 'Результаты по всем темам учебной программы:'
                          : 'Topic-by-Topic Assessment Breakdown:'}
                      </div>
                      {bundle.topic_analytics.map((t) => {
                        const rec = activeStudent.topic_scores[t.code];
                        if (!rec) return null;
                        const palette = getScoreColor(rec.score_pct);
                        return (
                          <div
                            key={t.code}
                            style={{
                              padding: '9px 12px',
                              borderRadius: '8px',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '12.5px',
                                marginBottom: '4px'
                              }}
                            >
                              <span>
                                <strong className="mono">[{t.code}]</strong>{' '}
                                {lang === 'ru' ? t.title_ru : t.title_en}
                              </span>
                              <span className="mono" style={{ fontWeight: 700 }}>
                                {rec.score_pct}% ({rec.time_spent_min} min)
                              </span>
                            </div>
                            <div className="progress-track" style={{ height: '7px' }}>
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${rec.score_pct}%`,
                                  background: palette.bar
                                }}
                              />
                            </div>
                            {rec.score_pct < 60 && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--status-critical)',
                                  marginTop: '4px'
                                }}
                              >
                                {lang === 'ru' ? 'Диагностика ошибки:' : 'Diagnostic tag:'}{' '}
                                {rec.error_tag}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ==================== TAB 6: GEMINI AI METHODOLOGIST WORKSPACE ==================== */}
          {activeTab === 'ai' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    {lang === 'ru'
                      ? 'ИИ-Методист на базе Google Gemini API'
                      : 'Google Gemini AI Educational Methodologist Co-Pilot'}
                  </h1>
                  <p className="page-subtitle">
                    {lang === 'ru'
                      ? 'Реальная интеграция с Google Gemini: интерпретация статистических расчетов, диагностика когнитивных пробелов, экспертиза учебников и генерация рекомендаций УМО.'
                      : 'Live Google Gemini integration interpreting real psychometric calculations, textbook value-added differentials, and curriculum hour reallocations.'}
                  </p>
                </div>
              </div>

              <AiAssistantPanel
                bundle={bundle}
                lang={lang}
                messages={aiMessages}
                setMessages={setAiMessages}
                isGenerating={isGeneratingAi}
                onSendChat={handleSendAiChat}
                onRunStructuredAnalysis={(type, code) =>
                  handleRunStructuredAnalysis(type, code, false)
                }
                onSaveToReport={(content) => {
                  setSavedReportAiSections((prev) => [
                    { content, modelUsed: 'gemini-3-flash-preview' },
                    ...prev
                  ]);
                  setSaveToast(
                    lang === 'ru'
                      ? 'Раздел ИИ добавлен в Аналитический отчет!'
                      : 'Gemini insight added to Analytical Report!'
                  );
                  setTimeout(() => setSaveToast(null), 3000);
                }}
              />
            </>
          )}

          {/* ==================== TAB 7: ANALYTICAL REPORTS ==================== */}
          {activeTab === 'reports' && (
            <ReportBuilderView
              bundle={bundle}
              lang={lang}
              savedAiSections={savedReportAiSections}
              isGeneratingAi={isGeneratingAi}
              onGenerateReportAi={() =>
                handleRunStructuredAnalysis('executive_summary', null, false)
              }
            />
          )}

          {/* ==================== TAB 8: DATASETS & CSV UPLOAD ==================== */}
          {activeTab === 'datasets' && (
            <DatasetManagerView
              bundle={bundle}
              lang={lang}
              onSelectDataset={(id) => handleDatasetSwitch(id)}
              onUploadSuccess={(newBundle) => {
                setBundle(newBundle);
                setDatasetId(newBundle.active_dataset.id);
                setSubjectId(newBundle.active_subject.id);
                setClassId('ALL');
                setTextbookId('ALL');
              }}
            />
          )}
        </main>
      </div>

      {/* Global Slide-Over Gemini AI Methodologist Drawer */}
      {aiDrawerOpen && (
        <div
          className="ai-drawer-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAiDrawerOpen(false);
          }}
        >
          <AiAssistantPanel
            bundle={bundle}
            lang={lang}
            messages={aiMessages}
            setMessages={setAiMessages}
            isGenerating={isGeneratingAi}
            onSendChat={handleSendAiChat}
            onRunStructuredAnalysis={(type, code) =>
              handleRunStructuredAnalysis(type, code, false)
            }
            onSaveToReport={(content) => {
              setSavedReportAiSections((prev) => [
                { content, modelUsed: 'gemini-3-flash-preview' },
                ...prev
              ]);
              setSaveToast(
                lang === 'ru'
                  ? 'Раздел ИИ добавлен в Аналитический отчет!'
                  : 'Gemini insight added to Analytical Report!'
              );
              setTimeout(() => setSaveToast(null), 3000);
            }}
            isDrawer={true}
            onCloseDrawer={() => setAiDrawerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
