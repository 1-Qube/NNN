# CurricuLab AI — Data-Driven Curriculum & Textbook Efficacy Platform

**CurricuLab AI** is an intelligent EdTech analytics platform built for educational methodologists and curriculum boards (УМО). It transforms empirical student assessment data into objective, data-driven decisions: diagnosing topic-level learning gaps, benchmarking competing textbooks with aptitude-controlled value-added models, optimizing annual teaching-hour distributions, and generating actionable pedagogical recommendations powered by **Google Gemini API**.

---

## Core Capabilities

1. **Multi-Subject & Topic-Level Psychometric Analytics**
   - Evaluates student performance across subjects, class cohorts, and individual curriculum topics.
   - Calculates Mean Mastery (%), Median, Interquartile Range (IQR), Standard Deviation ($\sigma$), Struggle Rate ($<55\%$), and a composite **Learning Difficulty Index (LDI)**.
   - Decomposes topic performance into **Conceptual Understanding**, **Procedural Fluency**, and **Applied Problem-Solving** to pinpoint the exact cognitive bottleneck.

2. **Interactive Class × Topic × Textbook Heatmap Matrix**
   - Visualizes every class cohort's mastery and struggle rate across all curriculum units.
   - Instant hover inspection and 1-click drill-down into topic diagnostic passports.

3. **Aptitude-Controlled Textbook Efficacy Benchmark**
   - Evaluates competing textbooks (*Mektep*, *AlmatyKitap*, *Atamura*, *Arman-PV*) using both raw scores and **Aptitude-Controlled Value-Added Residuals** ($\Delta_{\text{VA}}$) and **Cohen's $d$** effect size.
   - Identifies topic-by-topic textbook winners to support hybrid curriculum adoption (e.g., primary textbook + supplementary problem sets for high-difficulty chapters).

4. **Algorithmic Teaching-Hour Redistribution Engine**
   - Constrained mathematical optimization that shifts instructional hours from high-mastery "donor" units ($\ge 80\%$ mastery, low variance) to high-difficulty "recipient" units while respecting annual curriculum hour budgets and regulatory guardrails ($\pm 15\%$ to $\pm 50\%$).
   - Supports 3 optimization objective functions (`Balanced Psychometric`, `Remedial Focus`, `Prerequisite Shield`) plus interactive manual hour calibration persisted to SQLite.

5. **Live Google Gemini AI Methodologist Co-Pilot**
   - Integrated directly with Google Gemini API (`gemini-3-flash-preview` / `gemini-3.1-flash-lite` fallback chain).
   - Grounded strictly in the live statistical output of the platform's analytics engine—never invents or hallucinates numbers.
   - Includes 1-click deep-dive actions (*Diagnose Topic Gap*, *Compare Textbooks*, *Draft Board Hours Reallocation Memo*, *Executive Summary*) and bilingual (`RU` / `EN`) interactive chat.

6. **Custom CSV / JSON Dataset Upload & Built-in Synthetic Demonstration Data**
   - Ships with a clearly marked, statistically authentic **Synthetic Demonstration Dataset** (308 students, 11 classes, 4 Grade 9 subjects, 10 textbooks, 27 curriculum topics, and 2,156 assessments) so judges can explore every feature immediately.
   - Includes a 1-click **Grade 10 Molecular Biology CSV Sample Importer**, downloadable CSV template, and live CSV/JSON file upload & editor.

7. **Methodological Decision Report Builder**
   - Compiles executive KPIs, psychometric tables, textbook benchmarks, teaching-hour schedules, and Gemini AI commentary into an official dossier exportable as Markdown (`.md`), CSV (`.csv`), or printable PDF.

---

## Tech Stack

- **Frontend:** React 19, Vite 6, Lucide Icons, Custom Interactive SVG Charts & Heatmaps, Vanilla CSS Design System, Bilingual (`RU` / `EN`) i18n.
- **Backend:** Node.js, Express, REST API.
- **Database:** Native SQLite (`node:sqlite` in WAL mode) persisted at `data/curriculum.db`.
- **AI Engine:** Google Gemini REST API (`generativelanguage.googleapis.com/v1beta`) with real-time statistical context injection.

---

## Quick Start

1. **Configure Environment Variables**
   Copy `.env.example` to `.env` and set your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run End-to-End Verification & Self-Test**
   ```bash
   npm test
   ```

4. **Start the Full-Stack Application**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.
