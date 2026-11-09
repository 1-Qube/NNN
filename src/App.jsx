import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Clock,
  Sparkles,
  FileText,
  Database,
  CheckCircle2,
  ArrowRight,
  Sliders,
  Award,
  Search,
  RotateCcw,
  Save,
} from 'lucide-react';
import { T } from './i18n.js';
import {
  ClassTopicHeatmap,
  HoursOptimizationSVGChart,
  TextbookMultiDimensionChart,
  getScoreColor,
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
  callBrowserGemini,
} from './services/browserEngine.js';

export default function App() {
  const [lang, setLang] = useState('ru');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        'Здравствуйте! Я **CurricuLab AI** — интеллектуальный ассистент методиста на базе **Google Gemini**.\n\nЯ подключен к реальному статистическому движку платформы. Выберите любой предмет, класс, учебник или тему программы — я проанализирую когнитивные причины пробелов в знаниях, сравню эффективность учебников с учетом уровня классов и обосную оптимальное перераспределение учебных часов.\n\n*(Switch to **EN** in the top-right corner at any time for full English interface & AI responses.)*',
    },
  ]);
  const [topicDiagnosisCache, setTopicDiagnosisCache] = useState({});
  const [savedReportAiSections, setSavedReportAiSections] = useState([]);

  const dict = T[lang] || T.en;

  // Custom Cursor Implementation with Lag & Interactive Hover (Exact match to innovative hackaton.html)
  useEffect(() => {
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');

    if (!dot || !ring) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      dot.style.display = 'none';
      ring.style.display = 'none';
      document.body.classList.remove('custom-cursor-active');
      return;
    }

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;

    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    };

    const render = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(render);
    };

    const onMouseOver = (e) => {
      const target = e.target;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('.interactive-target') ||
        target.closest('.topic-bar-row')
      ) {
        ring.classList.add('cursor-hover');
        if (target.closest('.challenger-zone')) {
          ring.classList.add('cursor-challenger');
        }
      } else {
        ring.classList.remove('cursor-hover');
        ring.classList.remove('cursor-challenger');
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseover', onMouseOver);
    const animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseover', onMouseOver);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

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
            budgetDeltaHours: String(bDelta),
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
              budgetDeltaHours: Number(bDelta),
            },
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
      selectedTopicCode,
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
            lang,
          }),
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
          lang,
          mode: 'chat',
        });
        replyText = browserRes.text;
        modelUsed = browserRes.modelUsed;
      }

      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: replyText,
          modelUsed,
        },
      ]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error communicating with Gemini API:** ${err.message}`,
        },
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
          : 'Generate Executive Methodologist Curriculum Report',
    };

    setAiMessages((prev) => [
      ...prev,
      { role: 'user', content: labelMap[analysisType] || analysisType },
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
            lang,
          }),
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
          mode: analysisType,
        });
        analysisText = browserRes.text;
        modelUsed = browserRes.modelUsed;
      }

      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: analysisText,
          modelUsed,
        },
      ]);

      if (analysisType === 'topic_diagnosis' && (targetTopicCode || selectedTopicCode)) {
        setTopicDiagnosisCache((prev) => ({
          ...prev,
          [targetTopicCode || selectedTopicCode]: {
            content: analysisText,
            modelUsed,
          },
        }));
      }

      if (analysisType === 'executive_summary') {
        setSavedReportAiSections((prev) => [
          { content: analysisText, modelUsed },
          ...prev,
        ]);
      }
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error:** ${err.message}`,
        },
      ]);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveHoursToDatabase = async () => {
    if (!bundle) return;
    const allocations = Object.entries(customHoursMap).map(([topic_id, allocated_hours]) => ({
      topic_id,
      allocated_hours: Number(allocated_hours),
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
            allocations,
          }),
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

  const handleResetSavedHours = async () => {
    if (!bundle) return;
    try {
      let updatedBundle = null;
      try {
        const res = await fetch('/api/optimization/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId: bundle.active_dataset.id,
            subjectId: bundle.active_subject.id,
          }),
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          updatedBundle = data.bundle;
        }
      } catch {}

      if (!updatedBundle) {
        updatedBundle = resetBrowserHourOverrides(
          bundle.active_dataset.id,
          bundle.active_subject.id
        );
      }

      setBundle(updatedBundle);
      const nextHours = {};
      updatedBundle.optimization_plan.recommendations.forEach((r) => {
        nextHours[r.topic_id] = r.recommended_hours;
      });
      setCustomHoursMap(nextHours);
      setSaveToast(
        lang === 'ru'
          ? 'Часы сброшены к базовому плану!'
          : 'Teaching hours reset to baseline standard!'
      );
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  if (!bundle) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center p-8">
        <div className="border-2 border-ink bg-surface p-10 shadow-[8px_8px_0_#111]">
          <div className="inline-flex items-center gap-2 bg-lime border border-ink px-3 py-1 font-mono text-xs font-bold uppercase mb-3">
            <span className="w-2 h-2 bg-ink animate-ping"></span>
            CURRICULAB // ENGINE INITIALIZING
          </div>
          <h2 className="font-display text-3xl font-bold text-ink">
            Synthesizing Curriculum Telemetry…
          </h2>
        </div>
      </div>
    );
  }

  const activeSubject = bundle.active_subject;
  const kpis = bundle.kpis;
  const selectedTopic =
    bundle.topic_analytics.find((t) => t.code === selectedTopicCode) ||
    bundle.topic_analytics[0];

  const hardestTopic = [...bundle.topic_analytics].sort(
    (a, b) => b.difficulty_index - a.difficulty_index
  )[0];

  const easiestTopics = [...bundle.topic_analytics].filter(
    (t) => t.status === 'SURPLUS_MASTERY' || t.status === 'ON_TRACK'
  );
  const bottleneckTopics = [...bundle.topic_analytics].filter(
    (t) => t.status === 'CRITICAL_GAP' || t.status === 'MODERATE_STRUGGLE'
  );

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

  const navItems = [
    { id: 'dashboard', label: lang === 'ru' ? 'Overview' : 'Overview' },
    { id: 'diagnostics', label: lang === 'ru' ? '01 Сложные темы' : '01 Learning Gaps' },
    { id: 'textbooks', label: lang === 'ru' ? '02 Учебники' : '02 Textbooks' },
    { id: 'optimizer', label: lang === 'ru' ? '03 Часы' : '03 Hour Optimizer' },
    { id: 'students', label: lang === 'ru' ? '04 Ученики' : '04 Students' },
    { id: 'ai', label: lang === 'ru' ? '05 ИИ-Методист' : '05 Gemini AI' },
    { id: 'reports', label: lang === 'ru' ? '06 Отчет УМО' : '06 Reports' },
    { id: 'datasets', label: lang === 'ru' ? '07 Данные (CSV)' : '07 Datasets' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-ivory text-ink">
      {/* ==========================================
          TOP NAVIGATION (Exact match to innovative hackaton.html)
          ========================================== */}
      <header className="border-b-2 border-ink bg-ivory/95 backdrop-blur-sm sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="font-condensed text-3xl tracking-wider text-ink hover:opacity-80 transition-opacity flex items-center gap-2"
            >
              <span>CURRICULAB</span>
              <span className="w-2 h-2 bg-lime border border-ink inline-block"></span>
            </button>
            <span className="hidden xl:inline-block font-mono text-[10px] uppercase tracking-widest text-subtle border-l border-ink/20 pl-3 whitespace-nowrap">
              {lang === 'ru' ? 'ИИ-Аналитика учебных программ' : 'Data-Driven Curriculum Lab'}
            </span>
          </div>

          {/* Desktop Navigation Links — Single-line, zero wrapping */}
          <nav className="hidden lg:flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider shrink-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`whitespace-nowrap px-2.5 py-1.5 transition-all ${
                    isActive
                      ? 'bg-ink text-ivory font-bold'
                      : 'text-subtle hover:text-ink hover:bg-sand/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Direct CTA & Language Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center border border-ink bg-surface font-mono text-[11px] font-bold">
              <button
                onClick={() => setLang('ru')}
                className={`px-2 py-1.5 ${lang === 'ru' ? 'bg-lime text-ink' : 'text-subtle hover:text-ink'}`}
              >
                RU
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1.5 border-l border-ink ${lang === 'en' ? 'bg-lime text-ink' : 'text-subtle hover:text-ink'}`}
              >
                EN
              </button>
            </div>

            <button
              onClick={() => setAiDrawerOpen(true)}
              id="open-ai-drawer-btn"
              className="hidden sm:inline-flex items-center gap-2 bg-ink text-ivory hover:bg-black font-mono text-[11px] font-bold uppercase tracking-wider px-4 py-2 border border-ink transition-all whitespace-nowrap group"
            >
              <span>{dict.askGeminiBtn}</span>
              <span className="text-lime group-hover:translate-x-0.5 transition-transform">→</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-ink border border-ink/30"
              aria-label="Toggle menu"
            >
              <div className="w-5 h-3.5 flex flex-col justify-between">
                <span className={`h-0.5 bg-ink w-full transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                <span className={`h-0.5 bg-ink w-full ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`h-0.5 bg-ink w-full transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
              </div>
            </button>
          </div>
        </div>

        {/* Sub-Header Filter Strip (Subject, Class, Textbook & Dataset Dossier Selector) */}
        <div className="border-t-2 border-ink bg-surface px-5 md:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              {/* Subject Select */}
              <div className="flex items-center gap-1.5">
                <span className="uppercase text-subtle font-bold">01 // {dict.filterSubject}:</span>
                <select
                  id="global-subject-select"
                  value={activeSubject.id}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="bg-ivory border border-ink px-2.5 py-1 font-mono text-[11px] font-bold text-ink focus:outline-none"
                >
                  {bundle.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {lang === 'ru' ? s.name_ru : s.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Select */}
              <div className="flex items-center gap-1.5">
                <span className="uppercase text-subtle font-bold">02 // {dict.filterClass}:</span>
                <select
                  id="global-class-select"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="bg-ivory border border-ink px-2.5 py-1 font-mono text-[11px] font-bold text-ink focus:outline-none"
                >
                  <option value="ALL">{dict.allClasses}</option>
                  {bundle.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.student_count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Textbook Select */}
              <div className="flex items-center gap-1.5">
                <span className="uppercase text-subtle font-bold">03 // {dict.filterTextbook}:</span>
                <select
                  id="global-textbook-select"
                  value={textbookId}
                  onChange={(e) => setTextbookId(e.target.value)}
                  className="bg-ivory border border-ink px-2.5 py-1 font-mono text-[11px] font-bold text-ink focus:outline-none"
                >
                  <option value="ALL">{dict.allTextbooks}</option>
                  {bundle.textbooks.map((tb) => (
                    <option key={tb.id} value={tb.id}>
                      {tb.publisher} ({tb.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dataset Select */}
              <div className="flex items-center gap-1.5">
                <span className="uppercase text-subtle font-bold">04 // {dict.filterDataset}:</span>
                <select
                  id="global-dataset-select"
                  value={bundle.active_dataset.id}
                  onChange={(e) => handleDatasetSwitch(e.target.value)}
                  className="bg-ivory border border-ink px-2.5 py-1 font-mono text-[11px] font-bold text-ink focus:outline-none"
                >
                  {bundle.datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.is_synthetic ? '[DEMO] ' : '[CSV] '}
                      {lang === 'ru' ? d.name_ru : d.name_en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('datasets')}
              id="banner-switch-dataset-btn"
              className="inline-flex items-center gap-1.5 bg-lime border border-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-ink hover:bg-ink hover:text-ivory transition-colors"
            >
              <span className="w-2 h-2 bg-ink inline-block"></span>
              <span>
                {bundle.active_dataset.is_synthetic
                  ? lang === 'ru'
                    ? 'ДЕМО-ДАННЫЕ (ЗАГРУЗИТЬ CSV →)'
                    : 'SYNTHETIC DEMO DATA (UPLOAD CSV →)'
                  : lang === 'ru'
                  ? 'ПОЛЬЗОВАТЕЛЬСКИЙ CSV АКТИВЕН'
                  : 'CUSTOM CSV ACTIVE'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t-2 border-ink bg-ivory px-6 py-5 space-y-4">
            <div className="flex flex-col space-y-2 font-mono text-xs uppercase tracking-wider">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left py-2 px-3 ${
                    activeTab === item.id ? 'font-bold bg-ink text-ivory' : 'text-subtle border-b border-ink/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ==========================================
          OVERVIEW TAB (Exact Hero, BUILD/BREAK Card & 3-Step Pipeline of innovative hackaton.html)
          ========================================== */}
      {activeTab === 'dashboard' && (
        <div>
          {/* 1. Main Hero Section */}
          <section className="max-w-7xl mx-auto px-6 md:px-10 pt-10 md:pt-16 pb-14">
            {/* Superhead Status Pill */}
            <div className="inline-flex items-center gap-2.5 border border-ink bg-surface px-3.5 py-1.5 mb-8 shadow-[2px_2px_0_#111]">
              <span className="w-2 h-2 bg-lime border border-ink"></span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink font-bold">
                {lang === 'ru'
                  ? `DATA-DRIVEN CURRICULUM // ${activeSubject.code} (${activeSubject.total_planned_hours} Ч/ГОД)`
                  : `DATA-DRIVEN CURRICULUM // ${activeSubject.code} (${activeSubject.total_planned_hours} HRS/YR)`}
              </span>
            </div>

            {/* Two-Column Asymmetric Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Bold Editorial Headline & Thesis */}
              <div className="lg:col-span-7">
                <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[4.15rem] font-bold text-ink leading-[1.03] tracking-tight mb-6">
                  {lang === 'ru' ? (
                    <>
                      Учебным программам не нужны мнения.{' '}
                      <span className="bg-lime px-2 border border-ink inline-block mt-1">
                        Им нужны точные данные.
                      </span>
                    </>
                  ) : (
                    <>
                      Curriculum decisions don’t need opinions.{' '}
                      <span className="bg-lime px-2 border border-ink inline-block mt-1">
                        They need measurable data.
                      </span>
                    </>
                  )}
                </h1>

                <p className="font-sans text-base md:text-xl text-ink/80 max-w-2xl font-normal leading-relaxed mb-8">
                  {lang === 'ru' ? (
                    <>
                      По предмету <strong>«{activeSubject.name_ru}»</strong> проанализировано{' '}
                      <strong>{kpis.total_assessments} работ</strong> ({kpis.total_students} учеников). Выявлено{' '}
                      <strong>{kpis.critical_topics_count} критически сложных раздела</strong> (самая трудная тема —{' '}
                      <strong>{hardestTopic?.title_ru}</strong>, средний балл <strong>{hardestTopic?.mean_score}%</strong>).
                      Лучший результат показывает учебник <strong>{kpis.top_textbook?.title_ru}</strong>. Перераспределение{' '}
                      <strong>{kpis.hours_reallocated} часов</strong> повысит усвоение на{' '}
                      <strong>+{kpis.projected_mastery_gain}%</strong>.
                    </>
                  ) : (
                    <>
                      Across <strong>{activeSubject.name_en}</strong>, we analyzed{' '}
                      <strong>{kpis.total_assessments} assessments</strong> ({kpis.total_students} students). We identified{' '}
                      <strong>{kpis.critical_topics_count} critical bottleneck topics</strong> (hardest unit:{' '}
                      <strong>{hardestTopic?.title_en}</strong> at <strong>{hardestTopic?.mean_score}%</strong> mean). The
                      top-performing textbook is <strong>{kpis.top_textbook?.title_en}</strong>. Shifting{' '}
                      <strong>{kpis.hours_reallocated} teaching hours</strong> lifts mastery by{' '}
                      <strong>+{kpis.projected_mastery_gain}%</strong>.
                    </>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-10">
                  <button
                    onClick={() => setActiveTab('optimizer')}
                    id="dashboard-goto-optimizer-btn"
                    className="bg-ink text-ivory hover:bg-black font-mono text-xs md:text-sm font-bold uppercase tracking-wider px-7 py-4 border-2 border-ink shadow-[4px_4px_0_#C8FF2E] flex items-center gap-3 transition-transform active:translate-y-0.5"
                  >
                    <span>
                      {lang === 'ru'
                        ? `Перераспределить часы (${kpis.hours_reallocated} ч)`
                        : `Optimize Teaching Hours (${kpis.hours_reallocated}h)`}
                    </span>
                    <span className="text-lime font-bold">→</span>
                  </button>

                  <button
                    onClick={() => handleRunStructuredAnalysis('executive_summary', null, true)}
                    id="dashboard-ai-summary-btn"
                    className="bg-surface hover:bg-sand font-mono text-xs md:text-sm font-bold uppercase tracking-wider text-ink border-2 border-ink px-6 py-4 transition-colors"
                  >
                    {lang === 'ru' ? 'Объяснить выводы (Gemini AI)' : 'Explain Findings (Gemini AI)'}
                  </button>
                </div>

                {/* Quick Metric Strip */}
                <div className="grid grid-cols-3 gap-4 border-t border-ink/20 pt-6 max-w-xl">
                  <div>
                    <div className="font-condensed text-3xl text-ink">{kpis.overall_mean_score}%</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                      {lang === 'ru' ? `Средний балл (σ=${kpis.overall_std_dev}%)` : `Mean Mastery (σ=${kpis.overall_std_dev}%)`}
                    </div>
                  </div>
                  <div className="border-l border-ink/20 pl-4">
                    <div className="font-condensed text-3xl text-violet">{kpis.struggle_rate_pct}%</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                      {lang === 'ru' ? 'Группа риска (<55%)' : 'Struggle Rate (<55%)'}
                    </div>
                  </div>
                  <div className="border-l border-ink/20 pl-4">
                    <div className="font-condensed text-3xl text-ink">+{kpis.projected_mastery_gain}%</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                      {lang === 'ru' ? `Рост при сдвиге ${kpis.hours_reallocated} ч` : `Lift via ${kpis.hours_reallocated}h Shift`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Framed Architectural BUILD / BREAK Style Dossier Card */}
              <div className="lg:col-span-5 select-none">
                <div className="border-2 border-ink bg-surface p-6 md:p-8 shadow-[8px_8px_0_#111111]">
                  <div className="flex items-center justify-between border-b border-ink/20 pb-3 mb-6 font-mono text-[10px] uppercase tracking-widest text-subtle">
                    <span>CURRICULUM DIALECTIC // {activeSubject.code}</span>
                    <span className="text-ink font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-lime border border-ink"></span>
                      ACTIVE
                    </span>
                  </div>

                  {/* TOP BLOCK: OPTIMIZE / BUILD */}
                  <div
                    onClick={() => setActiveTab('optimizer')}
                    className="cursor-pointer flex items-center justify-between gap-4 bg-ivory border border-ink p-4 hover:bg-sand/50 transition-colors"
                  >
                    <div>
                      <span className="inline-block bg-lime border border-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink mb-1">
                        SIGNAL 01 // SOLUTION
                      </span>
                      <div className="font-condensed text-6xl sm:text-7xl text-ink leading-none">
                        SHIFT
                      </div>
                    </div>
                    <div className="text-right max-w-[175px]">
                      <span className="font-mono text-xs font-bold text-ink block mb-1">
                        {lang === 'ru' ? `${kpis.hours_reallocated} ч перераспределено` : `${kpis.hours_reallocated} Hours Reallocated`}
                      </span>
                      <span className="font-sans text-xs text-subtle block leading-snug">
                        {lang === 'ru'
                          ? `Учебник-лидер: ${kpis.top_textbook?.title_ru} (${kpis.top_textbook?.composite_efficacy}/100).`
                          : `Top textbook: ${kpis.top_textbook?.title_en} (${kpis.top_textbook?.composite_efficacy}/100).`}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal dividing friction bar */}
                  <div className="relative my-5 flex items-center justify-center">
                    <div className="w-full h-[2px] bg-ink"></div>
                    <span className="absolute bg-ink text-ivory font-mono text-[10px] uppercase tracking-widest px-3 py-0.5 border border-ink">
                      VS // CURRICULUM FRICTION
                    </span>
                  </div>

                  {/* BOTTOM BLOCK: GAPS / BREAK */}
                  <div
                    onClick={() => setActiveTab('diagnostics')}
                    className="challenger-zone cursor-pointer flex items-center justify-between gap-4 bg-ivory border border-ink p-4 hover:bg-sand/50 transition-colors"
                  >
                    <div className="text-left max-w-[175px]">
                      <span className="font-mono text-xs font-bold text-violet block mb-1">
                        {lang === 'ru' ? hardestTopic?.title_ru : hardestTopic?.title_en}
                      </span>
                      <span className="font-sans text-xs text-subtle block leading-snug">
                        {lang === 'ru'
                          ? `${hardestTopic?.struggle_rate}% учеников <55% · Средний балл ${hardestTopic?.mean_score}%.`
                          : `${hardestTopic?.struggle_rate}% students <55% · Mean score ${hardestTopic?.mean_score}%.`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-violet text-ivory border border-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                        SIGNAL 02 // BOTTLENECK
                      </span>
                      <div className="font-condensed text-6xl sm:text-7xl text-ink leading-none">
                        GAPS
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-6 pt-4 border-t border-ink/20 flex items-center justify-between font-mono text-[11px] text-subtle uppercase">
                    <span>
                      {lang === 'ru'
                        ? `${kpis.critical_topics_count} критических тем выявлено`
                        : `${kpis.critical_topics_count} Critical Bottlenecks`}
                    </span>
                    <button
                      onClick={() => setActiveTab('diagnostics')}
                      className="text-ink font-bold underline hover:text-violet"
                    >
                      {lang === 'ru' ? 'Открыть диагностику →' : 'Inspect Gaps →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Three Numbered Steps Section (Exact match to innovative hackaton.html) */}
          <section className="border-t-2 border-ink bg-surface">
            <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                  <span className="font-mono text-xs uppercase tracking-widest text-subtle block mb-1">
                    {lang === 'ru' ? 'Как работает CURRICULAB' : 'How CURRICULAB Works'}
                  </span>
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                    {lang === 'ru'
                      ? 'От сырых результатов тестирования до оптимального учебного плана за 3 шага'
                      : 'From raw student test scores to an optimized curriculum in 3 steps'}
                  </h2>
                </div>
                <span className="font-mono text-xs uppercase text-subtle">
                  {lang === 'ru' ? '3-этапный конвейер методиста' : '3-Stage Methodological Pipeline'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-ink bg-ivory shadow-[6px_6px_0_#111]">
                {/* Step 01 */}
                <div
                  onClick={() => setActiveTab('diagnostics')}
                  className="p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r-2 border-ink cursor-pointer hover:bg-surface transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-condensed text-4xl text-ink">01</span>
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-sand border border-ink/30 font-bold">
                        {lang === 'ru' ? 'Сложные темы' : 'Learning Gaps'}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-ink mb-3 tracking-tight">
                      {lang === 'ru' ? 'Выявите проблемные разделы' : 'Diagnose struggling units'}
                    </h3>
                    <p className="font-sans text-sm text-subtle leading-relaxed">
                      {lang === 'ru'
                        ? 'Автоматический расчет индекса трудности (LDI), доли отстающих (<55%) и тепловой карты Классы × Темы программы.'
                        : 'Automatically compute Learning Difficulty Index (LDI), struggle rates (<55%), and the Class × Topic mastery heatmap.'}
                    </p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-ink/15 flex items-center justify-between font-mono text-[11px] text-ink/70">
                    <span>{bundle.topic_analytics.length} Units Audited</span>
                    <span className="font-bold text-ink">
                      {lang === 'ru' ? 'Открыть темы →' : 'Open Diagnostics →'}
                    </span>
                  </div>
                </div>

                {/* Step 02 */}
                <div
                  onClick={() => setActiveTab('textbooks')}
                  className="p-8 flex flex-col justify-between bg-surface border-b md:border-b-0 md:border-r-2 border-ink cursor-pointer hover:bg-ivory transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-condensed text-4xl text-ink">02</span>
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-lime border border-ink font-bold">
                        {lang === 'ru' ? 'Учебники' : 'Textbook Benchmark'}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-ink mb-3 tracking-tight">
                      {lang === 'ru' ? 'Сравните учебники объективно' : 'Compare textbooks fairly'}
                    </h3>
                    <p className="font-sans text-sm text-subtle leading-relaxed">
                      {lang === 'ru'
                        ? 'Оценка эффективности учебников с поправкой на исходный уровень классов (Value-Added) и полноту покрытия стандарта.'
                        : 'Evaluate textbooks controlling for baseline class aptitude (Value-Added score), Cohen’s d effect size, and syllabus coverage.'}
                    </p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-ink/15 flex items-center justify-between font-mono text-[11px] text-ink/70">
                    <span>{bundle.textbooks.length} Editions Compared</span>
                    <span className="text-violet font-bold">
                      {lang === 'ru' ? 'Сравнить учебники →' : 'Compare Textbooks →'}
                    </span>
                  </div>
                </div>

                {/* Step 03 */}
                <div
                  onClick={() => setActiveTab('optimizer')}
                  className="p-8 flex flex-col justify-between cursor-pointer hover:bg-surface transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-condensed text-4xl text-ink">03</span>
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-ink text-ivory">
                        {lang === 'ru' ? 'Оптимизатор + ИИ' : 'Optimizer + AI Brief'}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-ink mb-3 tracking-tight">
                      {lang === 'ru' ? 'Перераспределите часы' : 'Reallocate teaching hours'}
                    </h3>
                    <p className="font-sans text-sm text-subtle leading-relaxed">
                      {lang === 'ru'
                        ? 'Перенесите часы с простых тем (≥80%) на сложные разделы в рамках годового бюджета и выгрузите отчет УМО с Gemini AI.'
                        : 'Shift hours from mastered units (≥80%) to critical bottlenecks within your annual budget and export a Gemini AI decision report.'}
                    </p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-ink/15 flex items-center justify-between font-mono text-[11px] text-ink/70">
                    <span>Export: Markdown, CSV & PDF</span>
                    <span className="text-ink font-bold">
                      {lang === 'ru' ? 'Запустить оптимизатор →' : 'Open Optimizer →'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ==========================================
          MAIN CONTENT CONTAINER (All 8 Functional Tabs Preserved 100%)
          ========================================== */}
      <main className="page-content">
        {saveToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-ink text-ivory px-5 py-3 border-2 border-ink shadow-[4px_4px_0_#C8FF2E]">
            <span className="w-2.5 h-2.5 bg-lime border border-ink"></span>
            <span className="font-mono text-xs uppercase tracking-wider">{saveToast}</span>
          </div>
        )}

        {/* ==================== 01 OVERVIEW DETAILS (KPIs, Topic Breakdown, Topic Inspector, Heatmap) ==================== */}
        {activeTab === 'dashboard' && (
          <>
            {/* 5 Clean Brutalist KPIs */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-card-top">
                  <span>01 // {dict.kpiMeanMastery}</span>
                  <span className="bg-lime px-1.5 border border-ink text-ink">ACTIVE</span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-value">{kpis.overall_mean_score}%</span>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ({dict.kpiMedianMastery}: {kpis.overall_median_score}%)
                  </span>
                </div>
                <div className="kpi-footnote">
                  {lang === 'ru'
                    ? `Средний балл по всем ${bundle.topic_analytics.length} темам программы (разброс σ=${kpis.overall_std_dev}%)`
                    : `Average score across all ${bundle.topic_analytics.length} curriculum topics (SD σ=${kpis.overall_std_dev}%)`}
                </div>
              </div>

              <div className="kpi-card challenger-zone">
                <div className="kpi-card-top">
                  <span>02 // {dict.kpiStruggleRate}</span>
                  <span className="bg-violet text-ivory px-1.5 border border-ink">RISK</span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-value" style={{ color: 'var(--status-critical)' }}>
                    {kpis.struggle_rate_pct}%
                  </span>
                </div>
                <div className="kpi-footnote">
                  {lang === 'ru'
                    ? 'Доля работ с результатом ниже пороговых 55%'
                    : 'Share of student assessments scoring below 55% threshold'}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-top">
                  <span>03 // {dict.kpiCriticalTopics}</span>
                  <span>BOTTLENECKS</span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-value" style={{ color: 'var(--status-critical)' }}>
                    {kpis.critical_topics_count}
                  </span>
                  <span className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>
                    + {kpis.moderate_topics_count} {lang === 'ru' ? 'сложных' : 'moderate'}
                  </span>
                </div>
                <div className="kpi-footnote">
                  {lang === 'ru'
                    ? `${kpis.surplus_topics_count} простых тем имеют избыточный запас часов (усвоение ≥80%)`
                    : `${kpis.surplus_topics_count} high-mastery topics (≥80%) can safely donate hours`}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-top">
                  <span>04 // {dict.kpiBestTextbook}</span>
                  <span className="bg-lime px-1.5 border border-ink text-ink">LEADER</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px', lineHeight: 1.25 }}>
                  {lang === 'ru' ? kpis.top_textbook?.title_ru : kpis.top_textbook?.title_en}
                </div>
                <div className="kpi-footnote">
                  {lang === 'ru' ? 'Рейтинг эффективности:' : 'Efficacy Index:'}{' '}
                  <strong className="mono">{kpis.top_textbook?.composite_efficacy}/100</strong> (
                  {kpis.top_textbook?.value_added_delta >= 0 ? '+' : ''}
                  {kpis.top_textbook?.value_added_delta}% {lang === 'ru' ? 'к результату' : 'value-added'})
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-top">
                  <span>05 // {dict.kpiOptimizationLift}</span>
                  <span className="bg-lime px-1.5 border border-ink text-ink">OPTIMIZED</span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-value">+{kpis.projected_mastery_gain}%</span>
                </div>
                <div className="kpi-footnote">
                  {lang === 'ru'
                    ? `При перераспределении ${kpis.hours_reallocated} ч в пользу трудных тем`
                    : `Expected gain from shifting ${kpis.hours_reallocated}h to struggling units`}
                </div>
              </div>
            </div>

            {/* Opposing Verdict Columns: Mastered Donor Topics vs Lethal Bottleneck Topics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Validated Strengths / Donor Units */}
              <div className="bg-surface border-2 border-ink p-7 shadow-[4px_4px_0_#111]">
                <div className="flex items-center justify-between border-b border-ink/15 pb-4 mb-5">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-subtle block">
                      {lang === 'ru' ? 'Сильные стороны // Доноры учебных часов' : 'Validated Strengths // Hour Donor Units'}
                    </span>
                    <h4 className="font-display text-2xl font-bold text-ink mt-0.5">
                      {lang === 'ru' ? 'Успешно усвоенные темы' : 'High-Mastery Curriculum Units'}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 bg-lime text-ink font-mono text-xs font-bold uppercase tracking-wider border border-ink">
                    {lang === 'ru' ? 'Норма / Профицит' : 'Mastered'}
                  </span>
                </div>
                <ul className="space-y-3 font-sans text-sm text-ink/90">
                  {easiestTopics.slice(0, 3).map((t, i) => (
                    <li
                      key={t.code}
                      onClick={() => setSelectedTopicCode(t.code)}
                      className="flex items-start justify-between gap-3 p-3 bg-ivory border border-ink/25 hover:border-ink cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs font-bold bg-lime border border-ink px-1.5 py-0.5 text-ink shrink-0">
                          0{i + 1}
                        </span>
                        <div>
                          <div className="font-bold text-ink">
                            [{t.code}] {lang === 'ru' ? t.title_ru : t.title_en}
                          </div>
                          <div className="font-mono text-[11px] text-subtle mt-0.5">
                            {t.planned_hours}h planned · {t.struggle_rate}% struggling · LDI {t.difficulty_index}/100
                          </div>
                        </div>
                      </div>
                      <span className="font-condensed text-2xl text-ink shrink-0">{t.mean_score}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Lethal Curriculum Bottlenecks */}
              <div className="challenger-zone bg-surface border-2 border-ink p-7 shadow-[4px_4px_0_#6E3AFF]">
                <div className="flex items-center justify-between border-b border-ink/15 pb-4 mb-5">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-violet block font-bold">
                      {lang === 'ru' ? 'Критические пробелы // Требуют часов' : 'Critical Bottlenecks // Immediate Action'}
                    </span>
                    <h4 className="font-display text-2xl font-bold text-ink mt-0.5">
                      {lang === 'ru' ? 'Сложные для усвоения разделы' : 'Struggling Curriculum Units'}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 bg-violet text-ivory font-mono text-xs font-bold uppercase tracking-wider border border-ink">
                    {lang === 'ru' ? 'Критично' : 'Bottleneck'}
                  </span>
                </div>
                <ul className="space-y-3 font-sans text-sm text-ink/90">
                  {bottleneckTopics.slice(0, 3).map((t, i) => (
                    <li
                      key={t.code}
                      onClick={() => setSelectedTopicCode(t.code)}
                      className="flex items-start justify-between gap-3 p-3 bg-ivory border border-ink/25 hover:border-violet cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs font-bold bg-violet text-ivory border border-ink px-1.5 py-0.5 shrink-0">
                          0{i + 1}
                        </span>
                        <div>
                          <div className="font-bold text-ink">
                            [{t.code}] {lang === 'ru' ? t.title_ru : t.title_en}
                          </div>
                          <div className="font-mono text-[11px] text-violet font-bold mt-0.5">
                            {t.struggle_rate}% &lt;55% · LDI {t.difficulty_index}/100 ·{' '}
                            {lang === 'ru' ? t.primary_bottleneck_ru : t.primary_bottleneck_en}
                          </div>
                        </div>
                      </div>
                      <span className="font-condensed text-2xl text-violet shrink-0">{t.mean_score}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Topic List + Selected Topic Diagnostic Inspector */}
            <div className="panel-grid-2">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="ieq-section-tag">CURRICULUM BREAKDOWN</div>
                    <div className="panel-title">
                      {lang === 'ru'
                        ? 'Усвоение по каждой теме программы'
                        : 'Student Performance Across Curriculum Topics'}
                    </div>
                    <div className="panel-subtitle">
                      {lang === 'ru'
                        ? 'Нажмите на любую тему, чтобы увидеть, почему ученики ошибаются и какой учебник работает лучше'
                        : 'Click any topic row to inspect why students struggle and which textbook performs best'}
                    </div>
                  </div>
                </div>
                <div
                  className="panel-body"
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  {bundle.topic_analytics.map((t, index) => {
                    const palette = getScoreColor(t.mean_score);
                    const isSelected = selectedTopic?.code === t.code;
                    return (
                      <div
                        key={t.id}
                        className={`topic-bar-row ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedTopicCode(t.code)}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              className="mono"
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                              }}
                            >
                              {String(index + 1).padStart(2, '0')} // {t.code}
                            </span>
                          </div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '14px',
                              marginTop: '2px',
                              lineHeight: 1.3,
                            }}
                          >
                            {lang === 'ru' ? t.title_ru : t.title_en}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              marginTop: '4px',
                            }}
                          >
                            {t.planned_hours} {lang === 'ru' ? 'ч по плану' : 'planned hrs'} •{' '}
                            <span style={{ color: 'var(--status-critical)', fontWeight: 700 }}>
                              {t.struggle_rate}% {lang === 'ru' ? 'не освоили (<55%)' : 'struggling (<55%)'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              marginBottom: '6px',
                            }}
                          >
                            <span style={{ color: 'var(--text-muted)' }}>
                              {lang === 'ru' ? 'Средний балл:' : 'Average Mastery:'}
                            </span>
                            <span className="mono" style={{ fontWeight: 700, fontSize: '13.5px' }}>
                              {t.mean_score}%
                            </span>
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${t.mean_score}%`,
                                background: palette.bar,
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

              {/* Right Column: Clean Topic Passport */}
              {selectedTopic && (
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="ieq-section-tag">
                        TOPIC INSPECTOR // {selectedTopic.code}
                      </div>
                      <div className="panel-title">
                        {lang === 'ru' ? selectedTopic.title_ru : selectedTopic.title_en}
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
                    style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px',
                      }}
                    >
                      <div className="control-card">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Средний балл' : 'Average Score'}
                        </div>
                        <div className="font-condensed" style={{ fontSize: '28px', marginTop: '2px' }}>
                          {selectedTopic.mean_score}%
                        </div>
                      </div>
                      <div className="control-card">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Не справились (<55%)' : 'Struggling (<55%)'}
                        </div>
                        <div
                          className="font-condensed"
                          style={{
                            fontSize: '28px',
                            marginTop: '2px',
                            color: 'var(--status-critical)',
                          }}
                        >
                          {selectedTopic.struggle_rate}%
                        </div>
                      </div>
                      <div className="control-card">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Индекс трудности' : 'Difficulty (LDI)'}
                        </div>
                        <div className="font-condensed" style={{ fontSize: '28px', marginTop: '2px' }}>
                          {selectedTopic.difficulty_index}/100
                        </div>
                      </div>
                    </div>

                    {/* Clear Plain-Language Error Box */}
                    <div
                      style={{
                        padding: '14px 16px',
                        background: 'var(--status-critical-bg)',
                        border: '2px solid var(--status-critical-border)',
                        fontSize: '13.5px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--status-critical)',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        {lang === 'ru'
                          ? 'ГЛАВНАЯ ПРИЧИНА ОШИБОК УЧЕНИКОВ:'
                          : 'PRIMARY CAUSE OF STUDENT ERRORS:'}
                      </div>
                      <div>
                        {lang === 'ru'
                          ? selectedTopic.common_error_ru || selectedTopic.common_error_en
                          : selectedTopic.common_error_en}
                      </div>
                    </div>

                    {/* Sub-skill Breakdown */}
                    <div className="control-card">
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          marginBottom: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          {lang === 'ru'
                            ? 'На каком этапе теряются баллы:'
                            : 'Skill Breakdown:'}
                        </span>
                        <span style={{ color: 'var(--status-critical)' }}>
                          {lang === 'ru'
                            ? selectedTopic.primary_bottleneck_ru
                            : selectedTopic.primary_bottleneck_en}
                        </span>
                      </div>

                      {[
                        {
                          label:
                            lang === 'ru'
                              ? '01. Понимание теории и концепций'
                              : '01. Conceptual Understanding',
                          val: selectedTopic.conceptual_avg,
                        },
                        {
                          label:
                            lang === 'ru'
                              ? '02. Выполнение стандартных алгоритмов'
                              : '02. Procedural Fluency',
                          val: selectedTopic.procedural_avg,
                        },
                        {
                          label:
                            lang === 'ru'
                              ? '03. Решение прикладных и нестандартных задач'
                              : '03. Applied Problem-Solving',
                          val: selectedTopic.applied_avg,
                        },
                      ].map((s, i) => (
                        <div key={i} style={{ marginBottom: '8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              marginBottom: '3px',
                            }}
                          >
                            <span>{s.label}</span>
                            <span className="mono" style={{ fontWeight: 700 }}>
                              {s.val}%
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '8px' }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: `${s.val}%`,
                                background: getScoreColor(s.val).bar,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Textbook Comparison for this topic */}
                    <div>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          marginBottom: '8px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {lang === 'ru'
                          ? `Сравнение учебников по теме [${selectedTopic.code}]:`
                          : `How Textbooks Perform on [${selectedTopic.code}]:`}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {selectedTopic.by_textbook.map((tb) => {
                          const isBest =
                            selectedTopic.best_textbook?.textbook_id === tb.textbook_id;
                          return (
                            <div
                              key={tb.textbook_id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '9px 12px',
                                background: isBest
                                  ? 'var(--status-success-bg)'
                                  : 'var(--bg-canvas)',
                                border: isBest
                                  ? '2px solid var(--ink)'
                                  : '1px solid var(--border-subtle)',
                                fontSize: '12.5px',
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>
                                {lang === 'ru' ? tb.title_ru : tb.title_en}{' '}
                                {isBest && (
                                  <strong>
                                    ({lang === 'ru' ? 'Лучший' : 'Best'})
                                  </strong>
                                )}
                              </span>
                              <span className="mono" style={{ fontWeight: 700 }}>
                                {tb.value_added_score}%
                              </span>
                            </div>
                          );
                        })}
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
                        ? `Получить поурочный план коррекции [${selectedTopic.code}] от Gemini AI`
                        : `Get Gemini AI Remediation Plan for [${selectedTopic.code}]`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Heatmap Matrix */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="ieq-section-tag">COHORT MATRIX // HEATMAP</div>
                  <div className="panel-title">
                    {lang === 'ru'
                      ? 'Карта успеваемости: Классы × Темы программы'
                      : 'Class Cohort × Curriculum Topic Heatmap'}
                  </div>
                  <div className="panel-subtitle">
                    {lang === 'ru'
                      ? 'Показывает средний процент выполнения и число отстающих учеников в каждом классе по каждой теме'
                      : 'Displays exact mastery percentage and number of struggling students per class and topic'}
                  </div>
                </div>
              </div>
              <div className="panel-body">
                <ClassTopicHeatmap
                  heatmapMatrix={bundle.heatmap_matrix}
                  topics={bundle.topic_analytics}
                  lang={lang}
                  selectedTopicCode={selectedTopic?.code}
                  onSelectTopic={(code) => setSelectedTopicCode(code)}
                />
              </div>
            </div>
          </>
        )}

        {/* ==================== 02 TOPIC LEARNING GAPS ==================== */}
        {activeTab === 'diagnostics' && (
          <>
            <div className="ieq-section-header">
              <div>
                <div className="ieq-section-tag">01 // TOPIC DIAGNOSTICS</div>
                <h1 className="page-title">
                  {lang === 'ru'
                    ? 'Диагностика сложных для усвоения тем программы'
                    : 'Curriculum Topic Learning Gaps & Bottleneck Diagnosis'}
                </h1>
                <p className="page-subtitle">
                  {lang === 'ru'
                    ? 'Полная таблица всех разделов учебной программы с оценкой когнитивной сложности, типичных ошибок и готовыми рекомендациями ИИ.'
                    : 'Complete breakdown of all curriculum topics with cognitive load, struggle rates, common student errors, and Gemini AI remediation plans.'}
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
                  ? `Разобрать тему [${selectedTopic?.code}] с Gemini AI`
                  : `Diagnose [${selectedTopic?.code}] with Gemini AI`}
              </button>
            </div>

            <div className="panel">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{lang === 'ru' ? 'Код' : 'Code'}</th>
                      <th>{lang === 'ru' ? 'Тема учебной программы' : 'Curriculum Topic'}</th>
                      <th>{lang === 'ru' ? 'Часы (План)' : 'Planned Hours'}</th>
                      <th>{lang === 'ru' ? 'Сложность' : 'Cognitive Load'}</th>
                      <th>{lang === 'ru' ? 'Средний / Медиана' : 'Mean / Median'}</th>
                      <th>{lang === 'ru' ? 'Не освоили (<55%)' : 'Struggle (<55%)'}</th>
                      <th>{lang === 'ru' ? 'Индекс LDI' : 'LDI Score'}</th>
                      <th>{lang === 'ru' ? 'Узкое место' : 'Bottleneck'}</th>
                      <th>{lang === 'ru' ? 'Лучший учебник' : 'Best Textbook'}</th>
                      <th>{lang === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{lang === 'ru' ? 'ИИ-разбор' : 'AI Action'}</th>
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
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
                                : 'var(--text-primary)',
                          }}
                        >
                          {t.struggle_rate}% ({t.struggle_count})
                        </td>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {t.difficulty_index}
                        </td>
                        <td style={{ fontSize: '12.5px' }}>
                          {lang === 'ru'
                            ? t.primary_bottleneck_ru
                            : t.primary_bottleneck_en}
                        </td>
                        <td className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>
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
                            <Sparkles size={13} />
                            {lang === 'ru' ? 'Разбор' : 'Diagnose'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedTopic && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="ieq-section-tag">GEMINI AI PEDAGOGICAL DIAGNOSIS</div>
                    <div className="panel-title">
                      [{selectedTopic.code}]{' '}
                      {lang === 'ru' ? selectedTopic.title_ru : selectedTopic.title_en}
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
                    {lang === 'ru' ? 'Запустить анализ Gemini' : 'Run Gemini Analysis'}
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
                        background: 'var(--bg-canvas)',
                        border: '2px solid var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                          {lang === 'ru'
                            ? `Тема [${selectedTopic.code}]: средний балл ${selectedTopic.mean_score}%, индекс трудности ${selectedTopic.difficulty_index}/100.`
                            : `Topic [${selectedTopic.code}]: Mean mastery ${selectedTopic.mean_score}%, Difficulty Index ${selectedTopic.difficulty_index}/100.`}
                        </div>
                        <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                          {lang === 'ru'
                            ? 'Нажмите кнопку справа, чтобы Gemini AI составил подробный методический разбор и план коррекции по этой теме.'
                            : 'Click the button to generate a detailed Gemini AI root-cause diagnosis and 3-step classroom remediation plan.'}
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
                        {lang === 'ru' ? 'Сгенерировать разбор' : 'Generate with Gemini'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== 03 TEXTBOOK BENCHMARK ==================== */}
        {activeTab === 'textbooks' && (
          <>
            <div className="ieq-section-header">
              <div>
                <div className="ieq-section-tag">02 // TEXTBOOK EFFICACY BENCHMARK</div>
                <h1 className="page-title">
                  {lang === 'ru'
                    ? 'Сравнение эффективности учебников на основе результатов учеников'
                    : 'Evidence-Based Textbook Comparison & Value-Added Ranking'}
                </h1>
                <p className="page-subtitle">
                  {lang === 'ru'
                    ? 'Справедливое сравнение учебников с учетом исходной подготовки классов (Value-Added), полноты покрытия программы и усвоения сложных тем.'
                    : 'Fair comparison of textbooks controlling for baseline class aptitude, curriculum coverage, and student outcomes on difficult topics.'}
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
                  ? 'Получить вердикт по учебникам от Gemini AI'
                  : 'Get Gemini AI Textbook Verdict'}
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '20px',
              }}
            >
              {bundle.textbook_comparisons.map((tb, idx) => (
                <div
                  key={tb.id}
                  className="panel"
                  style={{
                    boxShadow: idx === 0 ? '6px 6px 0 #C8FF2E' : '6px 6px 0 #111111',
                  }}
                >
                  <div className="panel-header">
                    <div>
                      <div className="ieq-section-tag">
                        0{idx + 1} // {tb.publisher} ({tb.code})
                      </div>
                      <div className="panel-title">
                        {lang === 'ru' ? tb.title_ru : tb.title_en}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {tb.authors} ({tb.year})
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="font-condensed" style={{ fontSize: '36px', lineHeight: 1 }}>
                        {tb.composite_efficacy}
                      </div>
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        SCORE / 100
                      </div>
                    </div>
                  </div>

                  <div
                    className="panel-body"
                    style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                  >
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      {lang === 'ru' ? tb.pedagogical_focus_ru : tb.pedagogical_focus_en}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="control-card">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Объективный балл (с поправкой)' : 'Aptitude-Adjusted Score'}
                        </div>
                        <div className="mono" style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px' }}>
                          {tb.aptitude_controlled_score}%{' '}
                          <span
                            style={{
                              fontSize: '12px',
                              color:
                                tb.value_added_delta >= 0
                                  ? 'var(--ink)'
                                  : 'var(--status-critical)',
                            }}
                          >
                            ({tb.value_added_delta >= 0 ? `+${tb.value_added_delta}%` : `${tb.value_added_delta}%`})
                          </span>
                        </div>
                      </div>

                      <div className="control-card">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Результат по сложным темам' : 'Hard Topics Mastery'}
                        </div>
                        <div className="mono" style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px' }}>
                          {tb.hard_topics_adjusted}%{' '}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            (d={tb.cohens_d})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '12.5px' }}>
                      <strong>
                        {lang === 'ru' ? 'Лучший выбор для тем:' : 'Best Performer For Topics:'}
                      </strong>{' '}
                      {tb.winning_topics.length > 0 ? (
                        tb.winning_topics.map((w) => (
                          <span
                            key={w.code}
                            className="mono"
                            style={{
                              display: 'inline-block',
                              margin: '2px 5px 2px 0',
                              padding: '2px 7px',
                              background: 'var(--lime)',
                              border: '1px solid var(--ink)',
                              color: 'var(--ink)',
                              fontWeight: 700,
                              fontSize: '11.5px',
                            }}
                          >
                            {w.code}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Базовое пособие' : 'Standard baseline'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="ieq-section-tag">6-FACTOR PROFILE</div>
                  <div className="panel-title">
                    {lang === 'ru'
                      ? 'Сравнение характеристик учебников по 6 критериям'
                      : 'Multi-Dimension Textbook Quality & Outcome Comparison'}
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

            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="ieq-section-tag">TOPIC-BY-TOPIC WINNER MATRIX</div>
                  <div className="panel-title">
                    {lang === 'ru'
                      ? 'Какой учебник лучше объясняет каждую отдельную тему'
                      : 'Topic-by-Topic Textbook Comparison Matrix'}
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
                            {tb.code}
                          </div>
                        </th>
                      ))}
                      <th>{lang === 'ru' ? 'Лидер по теме' : 'Recommended Textbook'}</th>
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
                                  ? 'rgba(200, 255, 46, 0.45)'
                                  : 'transparent',
                                fontWeight: isWinner ? 700 : 500,
                              }}
                            >
                              {cell ? `${cell.value_added_score}% (Raw: ${cell.mean_score}%)` : '—'}
                            </td>
                          );
                        })}
                        <td>
                          <span className="status-badge SURPLUS_MASTERY">
                            {topic.best_textbook?.textbook_code} —{' '}
                            {lang === 'ru'
                              ? topic.best_textbook?.title_ru
                              : topic.best_textbook?.title_en}
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

        {/* ==================== 04 HOUR OPTIMIZER ==================== */}
        {activeTab === 'optimizer' && (
          <>
            <div className="ieq-section-header">
              <div>
                <div className="ieq-section-tag">03 // TEACHING-HOUR OPTIMIZATION</div>
                <h1 className="page-title">
                  {lang === 'ru'
                    ? 'Рекомендации по перераспределению учебных часов'
                    : 'Optimal Teaching-Hour Redistribution Engine'}
                </h1>
                <p className="page-subtitle">
                  {lang === 'ru'
                    ? 'Алгоритм переносит часы с легко усваиваемых тем (≥80%) на сложные разделы программы без увеличения общей годовой нагрузки.'
                    : 'Automatically shifts hours from easily mastered topics (≥80%) to high-difficulty bottleneck units while keeping your total annual hours balanced.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    handleRunStructuredAnalysis('optimization_memo', null, true)
                  }
                  id="optimizer-ai-memo-btn"
                >
                  <Sparkles size={15} />
                  {lang === 'ru'
                    ? 'Составить пояснительную записку (Gemini AI)'
                    : 'Draft Board Justification Memo (Gemini AI)'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleResetSavedHours}
                >
                  <RotateCcw size={15} />
                  {lang === 'ru' ? 'Сбросить к стандарту' : 'Reset to Standard'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveHoursToDatabase}
                  id="save-hour-allocations-btn"
                >
                  <Save size={15} />
                  {lang === 'ru'
                    ? 'Сохранить новую сетку часов'
                    : 'Save Hour Schedule'}
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Sliders size={18} />
                  {lang === 'ru'
                    ? 'Настройка правил оптимизации учебного плана'
                    : 'Optimization Algorithm Controls'}
                </div>
              </div>
              <div
                className="panel-body"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                <div className="control-card">
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                    {lang === 'ru' ? 'Приоритет оптимизации:' : 'Optimization Strategy:'}
                  </label>
                  <select
                    className="ai-text-input"
                    style={{ width: '100%' }}
                    value={optStrategy}
                    onChange={(e) => setOptStrategy(e.target.value)}
                    id="optimizer-strategy-select"
                  >
                    <option value="balanced">
                      {lang === 'ru'
                        ? 'Сбалансированный (Трудность + Риск + Нагрузка)'
                        : 'Balanced (Difficulty + Struggle Rate + Cognitive Load)'}
                    </option>
                    <option value="remedial_focus">
                      {lang === 'ru'
                        ? 'Помощь отстающим (Максимум на группы риска <55%)'
                        : 'Remedial Focus (Prioritize Lifting Struggling Students <55%)'}
                    </option>
                    <option value="prerequisite_shield">
                      {lang === 'ru'
                        ? 'Фундаментальные темы (Защита базовых разделов)'
                        : 'Prerequisite Shield (Protect Foundational Topics)'}
                    </option>
                  </select>
                </div>

                <div className="control-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                    <span>
                      {lang === 'ru'
                        ? 'Допустимое изменение часов по одной теме:'
                        : 'Max Allowed Change Per Topic:'}
                    </span>
                    <span className="mono">±{optMaxChangePct}%</span>
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
                </div>

                <div className="control-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                    <span>
                      {lang === 'ru'
                        ? 'Дополнительные факультативные часы в год:'
                        : 'Additional Elective Hours Budget:'}
                    </span>
                    <span className="mono">
                      {optBudgetDelta >= 0 ? `+${optBudgetDelta}h` : `${optBudgetDelta}h`} (
                      {bundle.optimization_plan.summary.recommended_total_hours}h)
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
                </div>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-card-top">
                  <span>{lang === 'ru' ? 'Годовой бюджет часов' : 'Total Annual Hours'}</span>
                </div>
                <div className="kpi-value">
                  {bundle.optimization_plan.summary.baseline_total_hours}h →{' '}
                  {bundle.optimization_plan.summary.recommended_total_hours}h
                </div>
                <div className="kpi-footnote">
                  {lang === 'ru'
                    ? `Перераспределено между темами: ${bundle.optimization_plan.summary.total_hours_shifted} ч`
                    : `${bundle.optimization_plan.summary.total_hours_shifted}h shifted from mastered to struggling topics`}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-top">
                  <span>{lang === 'ru' ? 'Ожидаемый рост усвоения' : 'Projected Mastery Lift'}</span>
                </div>
                <div className="kpi-value">
                  {bundle.optimization_plan.summary.current_subject_mastery}% →{' '}
                  {bundle.optimization_plan.summary.projected_subject_mastery}%
                </div>
                <div className="kpi-footnote">
                  <strong className="bg-lime px-1.5 border border-ink">
                    +{bundle.optimization_plan.summary.projected_subject_gain}%
                  </strong>{' '}
                  {lang === 'ru' ? 'прирост среднего балла' : 'projected gain'}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-top">
                  <span>{lang === 'ru' ? 'Сокращение отстающих (<55%)' : 'Struggle Rate Reduction'}</span>
                </div>
                <div className="kpi-value">
                  {bundle.optimization_plan.summary.current_struggle_rate}% →{' '}
                  {bundle.optimization_plan.summary.projected_struggle_rate}%
                </div>
                <div className="kpi-footnote">
                  <strong className="bg-lime px-1.5 border border-ink">
                    -{bundle.optimization_plan.summary.projected_struggle_reduction}%
                  </strong>{' '}
                  {lang === 'ru' ? 'меньше неуспевающих' : 'fewer struggling students'}
                </div>
              </div>
            </div>

            <div className="panel-grid-2">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    {lang === 'ru'
                      ? 'Сравнение: Текущий план vs Рекомендуемые часы'
                      : 'Planned Hours vs Recommended Hours'}
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
                        ? 'Ручная корректировка и обоснование по каждой теме'
                        : 'Manual Hour Adjustment & Rationale'}
                    </div>
                  </div>
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
                      <div key={r.topic_id} className="control-card">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '6px',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
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
                                  [r.topic_id]: Number(e.target.value),
                                }))
                              }
                              className="mono"
                              style={{
                                width: '62px',
                                padding: '4px 6px',
                                border: '2px solid var(--ink)',
                                fontWeight: 700,
                                textAlign: 'center',
                                background: '#fff',
                              }}
                            />
                            <span className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>
                              h ({manualDelta >= 0 ? `+${manualDelta}h` : `${manualDelta}h`})
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
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

        {/* ==================== 05 STUDENTS ==================== */}
        {activeTab === 'students' && (
          <>
            <div className="ieq-section-header">
              <div>
                <div className="ieq-section-tag">04 // STUDENT PERFORMANCE EXPLORER</div>
                <h1 className="page-title">
                  {lang === 'ru'
                    ? 'Индивидуальные результаты учеников и группы риска'
                    : 'Student Performance & Risk Cohort Explorer'}
                </h1>
                <p className="page-subtitle">
                  {lang === 'ru'
                    ? 'Выберите любого ученика из списка, чтобы увидеть его оценки по каждой теме и конкретные пробелы.'
                    : 'Select any student to inspect their topic-by-topic scores, time spent, and specific learning gaps.'}
                </p>
              </div>
            </div>

            <div className="panel">
              <div
                className="panel-body"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                  <Search size={16} color="var(--text-muted)" />
                  <input
                    type="text"
                    className="ai-text-input"
                    placeholder={
                      lang === 'ru'
                        ? 'Поиск ученика по имени или коду...'
                        : 'Search student by name or ID code...'
                    }
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    id="student-search-input"
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'ALL', label: lang === 'ru' ? 'Все ученики' : 'All Students' },
                    {
                      id: 'Intervention Required',
                      label: lang === 'ru' ? 'Нужна помощь (<55%)' : 'Intervention Required (<55%)',
                    },
                    {
                      id: 'Developing',
                      label: lang === 'ru' ? 'Базовый (55–69%)' : 'Developing (55–69%)',
                    },
                    {
                      id: 'Proficient',
                      label: lang === 'ru' ? 'Хороший (70–84%)' : 'Proficient (70–84%)',
                    },
                    {
                      id: 'Advanced',
                      label: lang === 'ru' ? 'Отличный (≥85%)' : 'Advanced (≥85%)',
                    },
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
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    {lang === 'ru'
                      ? `Список учащихся (${filteredStudents.length})`
                      : `Student Roster (${filteredStudents.length})`}
                  </div>
                </div>
                <div className="table-wrap" style={{ maxHeight: '560px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'ru' ? 'Код' : 'Code'}</th>
                        <th>{lang === 'ru' ? 'ФИО ученика' : 'Student Name'}</th>
                        <th>{lang === 'ru' ? 'Класс' : 'Class'}</th>
                        <th>{lang === 'ru' ? 'Средний балл' : 'Mean Score'}</th>
                        <th>{lang === 'ru' ? 'Слабых тем' : 'Weak Topics'}</th>
                        <th>{lang === 'ru' ? 'Уровень' : 'Tier'}</th>
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

              {activeStudent && (
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="ieq-section-tag">STUDENT PROFILE // {activeStudent.student_code}</div>
                      <div className="panel-title">{activeStudent.full_name}</div>
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
                    {bundle.topic_analytics.map((t) => {
                      const rec = activeStudent.topic_scores[t.code];
                      if (!rec) return null;
                      const palette = getScoreColor(rec.score_pct);
                      return (
                        <div key={t.code} className="control-card">
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                              marginBottom: '5px',
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
                          <div className="progress-track" style={{ height: '8px' }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: `${rec.score_pct}%`,
                                background: palette.bar,
                              }}
                            />
                          </div>
                          {rec.score_pct < 60 && (
                            <div
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--status-critical)',
                                marginTop: '5px',
                                fontWeight: 600,
                              }}
                            >
                              {lang === 'ru' ? 'Типичная ошибка:' : 'Error tag:'} {rec.error_tag}
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

        {/* ==================== 06 GEMINI AI CO-PILOT ==================== */}
        {activeTab === 'ai' && (
          <>
            <div className="ieq-section-header">
              <div>
                <div className="ieq-section-tag">05 // GOOGLE GEMINI AI METHODOLOGIST</div>
                <h1 className="page-title">
                  {lang === 'ru'
                    ? 'ИИ-Ассистент методиста (Google Gemini API)'
                    : 'Google Gemini AI Methodologist Co-Pilot'}
                </h1>
                <p className="page-subtitle">
                  {lang === 'ru'
                    ? 'Задайте любой вопрос или нажмите на быстрые кнопки — Gemini интерпретирует реальные расчеты вашей учебной программы.'
                    : 'Ask any question or click a quick-action button — Gemini interprets your live calculated curriculum statistics.'}
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
                  ...prev,
                ]);
                setSaveToast(
                  lang === 'ru'
                    ? 'Ответ Gemini добавлен в Аналитический отчет!'
                    : 'Gemini insight added to Analytical Report!'
                );
                setTimeout(() => setSaveToast(null), 3000);
              }}
            />
          </>
        )}

        {/* ==================== 07 REPORTS ==================== */}
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

        {/* ==================== 08 DATASETS ==================== */}
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

      {/* Minimalist Editorial Footer (Exact match to innovative hackaton.html) */}
      <footer className="border-t-2 border-ink py-10 bg-ivory no-print mt-auto">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="font-condensed text-2xl tracking-wider">CURRICULAB</span>
            <span className="font-mono text-xs text-subtle border-l border-ink/20 pl-4">
              {lang === 'ru'
                ? 'Интеллектуальная система оценки эффективности учебников и учебных программ'
                : 'Data-Driven Curriculum & Textbook Efficacy Lab — Built for Methodologists & Judges'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono text-xs uppercase text-subtle">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="hover:text-ink"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </footer>

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
                ...prev,
              ]);
              setSaveToast(
                lang === 'ru'
                  ? 'Ответ Gemini добавлен в Аналитический отчет!'
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
