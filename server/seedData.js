// Deterministic PRNG (Mulberry32) for reproducible, statistically authentic demonstration data
function createRng(seed = 20261109) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(rng, mean = 0, stdDev = 1) {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export const DEMO_SUBJECTS = [
  {
    id: 'SUB-MATH-9',
    code: 'MATH-09',
    name_en: 'Algebra & Mathematical Analysis (Grade 9)',
    name_ru: 'Алгебра и начала анализа (9 класс)',
    grade: 9,
    total_planned_hours: 102,
    description_en: 'Core secondary mathematics curriculum covering quadratic systems, sequences, trigonometry, combinatorics, and planar vectors.',
    description_ru: 'Базовая и углубленная программа 9 класса: нелинейные системы, прогрессии, тригонометрия, комбинаторика и векторы.'
  },
  {
    id: 'SUB-PHYS-9',
    code: 'PHYS-09',
    name_en: 'Physics & Electromagnetism (Grade 9)',
    name_ru: 'Физика и электродинамика (9 класс)',
    grade: 9,
    total_planned_hours: 68,
    description_en: 'Mechanics, conservation laws, mechanical waves, electromagnetic induction, optics, and nuclear physics fundamentals.',
    description_ru: 'Кинематика, законы сохранения, колебания и волны, электромагнитная индукция, оптика и квантовая физика.'
  },
  {
    id: 'SUB-CHEM-9',
    code: 'CHEM-09',
    name_en: 'Inorganic & Structural Chemistry (Grade 9)',
    name_ru: 'Неорганическая и структурная химия (9 класс)',
    grade: 9,
    total_planned_hours: 68,
    description_en: 'Electrolytic dissociation, redox reactions, chemical equilibrium, non-metals, transition metals, and initial organic chemistry.',
    description_ru: 'Электролитическая диссоциация, ОВР, химическое равновесие, химия неметаллов, металлов и введение в органику.'
  },
  {
    id: 'SUB-CS-9',
    code: 'CS-09',
    name_en: 'Computer Science & Algorithms (Grade 9)',
    name_ru: 'Информатика и алгоритмизация (9 класс)',
    grade: 9,
    total_planned_hours: 34,
    description_en: 'Algorithmic complexity, 2D matrices, sorting/searching, recursion, relational SQL databases, and applied data modeling.',
    description_ru: 'Алгоритмическая сложность, двумерные массивы, сортировка, рекурсия, базы данных SQL и анализ данных.'
  }
];

export const DEMO_TEXTBOOKS = [
  // Mathematics Textbooks
  {
    id: 'TB-MATH-MEKTEP',
    subject_id: 'SUB-MATH-9',
    code: 'MK-ALG9-24',
    title_en: 'Unified Algebra & Functions 9 (Mektep Press)',
    title_ru: 'Алгебра и функции 9 (Изд. «Мектеп»)',
    publisher: 'Mektep Publishing',
    authors: 'A. N. Shynybekov, D. A. Shynybekov, R. N. Zhumabayeva',
    year: 2024,
    edition: '4th Revised Edition',
    pedagogical_focus_en: 'Visual unit-circle scaffolding, step-by-step identity proofs, and graduated problem ladders.',
    pedagogical_focus_ru: 'Визуальное моделирование тригонометрического круга, пошаговые доказательства тождеств и уровневые задачи.',
    cost_per_unit: 18.5,
    coverage_index: 94,
    readability_score: 88,
    practice_density: 92,
    topic_Search_Modifiers: {
      'M9-T1': +2.5,
      'M9-T2': +3.0,
      'M9-T3': +1.8,
      'M9-T4': +9.4, // Strong visual unit-circle approach boosts trigonometry significantly
      'M9-T5': +7.8,
      'M9-T6': -2.5,
      'M9-T7': +2.0,
      'M9-T8': +4.2
    }
  },
  {
    id: 'TB-MATH-ALMATY',
    subject_id: 'SUB-MATH-9',
    code: 'AK-ALG9-23',
    title_en: 'Theoretical Algebra 9 (AlmatyKitap)',
    title_ru: 'Теоретическая алгебра 9 («Алматыкітап»)',
    publisher: 'AlmatyKitap Baspasy',
    authors: 'A. E. Abylkassymova, T. P. Kurbangaliyeva, V. E. Korchevsky',
    year: 2023,
    edition: '3rd Standard Edition',
    pedagogical_focus_en: 'Dense axiomatic definitions and formal algebraic transformations with fewer worked examples.',
    pedagogical_focus_ru: 'Аксиоматическое изложение теории и формальные преобразования с меньшим числом разобранных примеров.',
    cost_per_unit: 16.0,
    coverage_index: 86,
    readability_score: 71,
    practice_density: 78,
    topic_Search_Modifiers: {
      'M9-T1': +1.0,
      'M9-T2': -2.4,
      'M9-T3': +0.5,
      'M9-T4': -7.2, // Students struggle with abstract trig proofs without visual diagrams
      'M9-T5': -8.5,
      'M9-T6': -4.0,
      'M9-T7': +1.5,
      'M9-T8': -5.1
    }
  },
  {
    id: 'TB-MATH-ATAMURA',
    subject_id: 'SUB-MATH-9',
    code: 'AT-ALG9-24',
    title_en: 'Applied Mathematics & Modeling 9 (Atamura)',
    title_ru: 'Прикладная алгебра и моделирование 9 («Атамұра»)',
    publisher: 'Atamura Corporation',
    authors: 'T. A. Aldamuratova, K. S. Baisholanov, E. S. Baisholanov',
    year: 2024,
    edition: '5th STEM Edition',
    pedagogical_focus_en: 'Strong real-world modeling, combinatorics, and probability simulations; moderate abstract proof coverage.',
    pedagogical_focus_ru: 'Акцент на прикладное моделирование, комбинаторику и вероятность; умеренная глубина формальных доказательств.',
    cost_per_unit: 19.0,
    coverage_index: 91,
    readability_score: 85,
    practice_density: 89,
    topic_Search_Modifiers: {
      'M9-T1': +1.8,
      'M9-T2': +1.2,
      'M9-T3': +4.1,
      'M9-T4': -1.2,
      'M9-T5': -0.8,
      'M9-T6': +10.2, // Best-in-class combinatorics & probability chapters
      'M9-T7': +3.4,
      'M9-T8': +8.6  // Best-in-class mathematical modeling
    }
  },

  // Physics Textbooks
  {
    id: 'TB-PHYS-MEKTEP',
    subject_id: 'SUB-PHYS-9',
    code: 'MK-PHY9-24',
    title_en: 'Conceptual & Lab Physics 9 (Mektep Press)',
    title_ru: 'Концептуальная и экспериментальная физика 9 («Мектеп»)',
    publisher: 'Mektep Publishing',
    authors: 'N. A. Zhakipbekova, B. M. Duisembayev, S. K. Tleubergenova',
    year: 2024,
    edition: '4th Edition',
    pedagogical_focus_en: 'Inquiry-based lab simulations, vector field diagrams for electromagnetism, and diagnostic checkpoints.',
    pedagogical_focus_ru: 'Лабораторный практикум, векторная визуализация магнитного потока и диагностические разборы ошибок.',
    cost_per_unit: 21.0,
    coverage_index: 95,
    readability_score: 89,
    practice_density: 90,
    topic_Search_Modifiers: {
      'P9-T1': +3.2,
      'P9-T2': +4.0,
      'P9-T3': +5.5,
      'P9-T4': +8.8, // Superior right-hand rule & flux diagrams
      'P9-T5': +6.2,
      'P9-T6': +2.5,
      'P9-T7': +4.9
    }
  },
  {
    id: 'TB-PHYS-ATAMURA',
    subject_id: 'SUB-PHYS-9',
    code: 'AT-PHY9-23',
    title_en: 'Classical Mechanics & Electrodynamics 9 (Atamura)',
    title_ru: 'Классическая механика и электродинамика 9 («Атамұра»)',
    publisher: 'Atamura Corporation',
    authors: 'R. Basharov, S. Tuyakbayev, Sh. Nasokhova',
    year: 2023,
    edition: '3rd Edition',
    pedagogical_focus_en: 'Traditional formula-heavy presentation; strong kinematics & optics, sparse visuals for magnetic flux.',
    pedagogical_focus_ru: 'Традиционное изложение с упором на формулы; сильная оптика и механика, мало иллюстраций по индукции.',
    cost_per_unit: 17.5,
    coverage_index: 84,
    readability_score: 74,
    practice_density: 81,
    topic_Search_Modifiers: {
      'P9-T1': +2.8,
      'P9-T2': +1.0,
      'P9-T3': -4.2,
      'P9-T4': -8.4,
      'P9-T5': -5.6,
      'P9-T6': +4.1,
      'P9-T7': -3.8
    }
  },
  {
    id: 'TB-PHYS-ARMAN',
    subject_id: 'SUB-PHYS-9',
    code: 'AR-PHY9-24',
    title_en: 'Problem-Based Olympiad Physics 9 (Arman-PV)',
    title_ru: 'Задачная физика и практикум 9 («Арман-ПВ»)',
    publisher: 'Arman-PV Publishing',
    authors: 'A. Kalygulov, M. Kranbayeva',
    year: 2024,
    edition: '2nd Edition',
    pedagogical_focus_en: 'High density of quantitative multi-step problems; effective for high-aptitude cohorts.',
    pedagogical_focus_ru: 'Высокая плотность расчетных задач повышенной сложности; эффективно для профильных классов.',
    cost_per_unit: 20.0,
    coverage_index: 90,
    readability_score: 79,
    practice_density: 95,
    topic_Search_Modifiers: {
      'P9-T1': +1.5,
      'P9-T2': +3.5,
      'P9-T3': +1.8,
      'P9-T4': +1.2,
      'P9-T5': +2.4,
      'P9-T6': +1.0,
      'P9-T7': +2.2
    }
  },

  // Chemistry Textbooks
  {
    id: 'TB-CHEM-MEKTEP',
    subject_id: 'SUB-CHEM-9',
    code: 'MK-CHM9-24',
    title_en: 'Structural & Reaction Chemistry 9 (Mektep Press)',
    title_ru: 'Структурная химия и механизмы реакций 9 («Мектеп»)',
    publisher: 'Mektep Publishing',
    authors: 'M. K. Ospanova, K. S. Aukhadieva, T. G. Belousova',
    year: 2024,
    edition: '4th Edition',
    pedagogical_focus_en: 'Algorithmic half-reaction scaffolding for redox chemistry and visual orbital diagrams.',
    pedagogical_focus_ru: 'Алгоритмические схемы электронного баланса для ОВР и визуальные схемы смещения равновесия.',
    cost_per_unit: 19.5,
    coverage_index: 93,
    readability_score: 87,
    practice_density: 91,
    topic_Search_Modifiers: {
      'C9-T1': +3.5,
      'C9-T2': +8.2,
      'C9-T3': +6.5,
      'C9-T4': +2.0,
      'C9-T5': +2.4,
      'C9-T6': +5.8
    }
  },
  {
    id: 'TB-CHEM-ATAMURA',
    subject_id: 'SUB-CHEM-9',
    code: 'AT-CHM9-23',
    title_en: 'General & Descriptive Chemistry 9 (Atamura)',
    title_ru: 'Общая и неорганическая химия 9 («Атамұра»)',
    publisher: 'Atamura Corporation',
    authors: 'M. B. Usmanova, K. N. Sakariyanova',
    year: 2023,
    edition: '3rd Edition',
    pedagogical_focus_en: 'Strong descriptive encyclopedic coverage of elements and metals; brief treatment of redox kinetics.',
    pedagogical_focus_ru: 'Богатый описательный материал по химии элементов и сплавов; краткое изложение кинетики и ОВР.',
    cost_per_unit: 17.0,
    coverage_index: 85,
    readability_score: 80,
    practice_density: 79,
    topic_Search_Modifiers: {
      'C9-T1': -1.5,
      'C9-T2': -7.4,
      'C9-T3': -5.9,
      'C9-T4': +3.8,
      'C9-T5': +4.2,
      'C9-T6': -4.6
    }
  },

  // Computer Science Textbooks
  {
    id: 'TB-CS-ARMAN',
    subject_id: 'SUB-CS-9',
    code: 'AR-CS9-24',
    title_en: 'Python Algorithms, Data Structures & SQL 9 (Arman-PV)',
    title_ru: 'Алгоритмы Python, структуры данных и SQL 9 («Арман-ПВ»)',
    publisher: 'Arman-PV Publishing',
    authors: 'B. K. Kadyrov, A. R. Nurmukhamedov',
    year: 2024,
    edition: '3rd Code-First Edition',
    pedagogical_focus_en: 'Interactive call-stack traces for recursion, memory-grid visuals for 2D arrays, and hands-on SQLite labs.',
    pedagogical_focus_ru: 'Трассировка стека вызовов для рекурсии, визуализация матриц в памяти и практикум по SQL-запросам.',
    cost_per_unit: 22.0,
    coverage_index: 96,
    readability_score: 91,
    practice_density: 94,
    topic_Search_Modifiers: {
      'CS9-T1': +2.0,
      'CS9-T2': +7.5,
      'CS9-T3': +8.1,
      'CS9-T4': +9.2,
      'CS9-T5': +5.4,
      'CS9-T6': +4.8
    }
  },
  {
    id: 'TB-CS-ALMATY',
    subject_id: 'SUB-CS-9',
    code: 'AK-CS9-23',
    title_en: 'Informatics & Information Systems 9 (AlmatyKitap)',
    title_ru: 'Информатика и информационные системы 9 («Алматыкітап»)',
    publisher: 'AlmatyKitap Baspasy',
    authors: 'G. I. Salgaraeva, Zh. B. Bazarkulova',
    year: 2023,
    edition: '2nd Edition',
    pedagogical_focus_en: 'Strong theoretical encoding and IT concepts; limited code debugging traces for recursion and complexity.',
    pedagogical_focus_ru: 'Хорошая база по кодированию информации и логике; недостаточно примеров отладки рекурсии и оценки сложности.',
    cost_per_unit: 16.5,
    coverage_index: 83,
    readability_score: 77,
    practice_density: 74,
    topic_Search_Modifiers: {
      'CS9-T1': +3.1,
      'CS9-T2': -6.4,
      'CS9-T3': -7.5,
      'CS9-T4': -8.8,
      'CS9-T5': -3.2,
      'CS9-T6': -2.1
    }
  }
];

export const DEMO_TOPICS = [
  // Mathematics Grade 9 (Total: 102 hours)
  {
    id: 'TOP-M9-1',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T1',
    order_num: 1,
    unit_en: 'Unit 1: Equations & Inequalities',
    unit_ru: 'Раздел 1: Уравнения и неравенства',
    title_en: 'Quadratic Equations, Vieta Theorem & Rational Inequalities',
    title_ru: 'Квадратные уравнения, теорема Виета и дробно-рациональные неравенства',
    planned_hours: 16,
    cognitive_load: 2.1,
    prerequisite_topic_code: null,
    bloom_level: 'Application',
    key_concepts_en: 'Discriminant analysis, interval method, sign charts, root parametrization',
    key_concepts_ru: 'Метод интервалов, теорема Виета, ОДЗ дробно-рациональных неравенств',
    base_mastery: 83.8,
    std_dev: 9.2,
    common_error_en: 'Sign-flip omission when multiplying rational inequalities by negative denominators',
    common_error_ru: 'Потеря смены знака при умножении неравенства и пропуск выколотых точек ОДЗ'
  },
  {
    id: 'TOP-M9-2',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T2',
    order_num: 2,
    unit_en: 'Unit 1: Equations & Inequalities',
    unit_ru: 'Раздел 1: Уравнения и неравенства',
    title_en: 'Systems of Non-Linear Equations in Two Variables',
    title_ru: 'Системы нелинейных уравнений с двумя переменными',
    planned_hours: 12,
    cognitive_load: 3.3,
    prerequisite_topic_code: 'M9-T1',
    bloom_level: 'Analysis',
    key_concepts_en: 'Symmetric substitution, homogeneous systems, graphical intersection',
    key_concepts_ru: 'Метод подстановки, однородные системы, замена переменных, графический метод',
    base_mastery: 67.4,
    std_dev: 12.5,
    common_error_en: 'Incomplete root pairing after auxiliary variable back-substitution',
    common_error_ru: 'Неполный перебор пар корней при обратной подстановке вспомогательной переменной'
  },
  {
    id: 'TOP-M9-3',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T3',
    order_num: 3,
    unit_en: 'Unit 2: Sequences & Progressions',
    unit_ru: 'Раздел 2: Числовые последовательности',
    title_en: 'Arithmetic & Geometric Progressions and Infinite Series',
    title_ru: 'Арифметическая и геометрическая прогрессии, бесконечно убывающая прогрессия',
    planned_hours: 14,
    cognitive_load: 2.6,
    prerequisite_topic_code: 'M9-T1',
    bloom_level: 'Application',
    key_concepts_en: 'n-th term formula, partial sums, infinite convergence |q| < 1',
    key_concepts_ru: 'Формула n-го члена, сумма первых n членов, сходимость при |q| < 1',
    base_mastery: 76.9,
    std_dev: 10.8,
    common_error_en: 'Index shift error (confusing n with n-1 in geometric ratio exponent)',
    common_error_ru: 'Ошибка сдвига индекса (путаница между n и n-1 в показателе степени знаменателя q)'
  },
  {
    id: 'TOP-M9-4',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T4',
    order_num: 4,
    unit_en: 'Unit 3: Trigonometry',
    unit_ru: 'Раздел 3: Тригонометрия',
    title_en: 'Trigonometric Identities, Reduction Formulas & Double-Angle Proofs',
    title_ru: 'Тригонометрические тождества, формулы приведения и двойного угла',
    planned_hours: 12,
    cognitive_load: 4.7,
    prerequisite_topic_code: 'M9-T2',
    bloom_level: 'Evaluation',
    key_concepts_en: 'Unit circle quadrants, co-function reduction, sum-to-product transformations',
    key_concepts_ru: 'Формулы приведения, знаки по четвертям, формулы суммы и двойного аргумента',
    base_mastery: 47.6,
    std_dev: 15.8,
    common_error_en: 'Quadrant sign errors in reduction formulas (π/2 ± α, 3π/2 ± α) and illegal cancellation',
    common_error_ru: 'Ошибки знака четверти в формулах приведения (3π/2 ± α) и неверное разложение cos(2α)'
  },
  {
    id: 'TOP-M9-5',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T5',
    order_num: 5,
    unit_en: 'Unit 3: Trigonometry',
    unit_ru: 'Раздел 3: Тригонометрия',
    title_en: 'Inverse Trigonometric Functions & General Periodic Equations',
    title_ru: 'Обратные тригонометрические функции и тригонометрические уравнения',
    planned_hours: 10,
    cognitive_load: 4.9,
    prerequisite_topic_code: 'M9-T4',
    bloom_level: 'Synthesis',
    key_concepts_en: 'Principal value domains of arcsin/arccos, root selection on intervals',
    key_concepts_ru: 'Область значений arcsin/arccos, отбор корней уравнения на заданном отрезке',
    base_mastery: 43.9,
    std_dev: 16.4,
    common_error_en: 'Domain violation on arccos(-x) = π - arccos(x) and missing periodic branches +2πk',
    common_error_ru: 'Нарушение области значений arccos(-x) = π - arccos(x) и потеря серии корней при отборе на отрезке'
  },
  {
    id: 'TOP-M9-6',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T6',
    order_num: 6,
    unit_en: 'Unit 4: Combinatorics & Probability',
    unit_ru: 'Раздел 4: Комбинаторика и теория вероятностей',
    title_en: 'Permutations, Combinations, Binomial Theorem & Conditional Probability',
    title_ru: 'Перестановки, размещения, сочетания, бином Ньютона и условная вероятность',
    planned_hours: 10,
    cognitive_load: 3.9,
    prerequisite_topic_code: 'M9-T3',
    bloom_level: 'Analysis',
    key_concepts_en: 'Order sensitivity (A_n^k vs C_n^k), dependent events, complement rule',
    key_concepts_ru: 'Различение размещений и сочетаний (учет порядка), зависимые события, формула Бернулли',
    base_mastery: 56.8,
    std_dev: 14.1,
    common_error_en: 'Confusing ordered arrangements (permutations) with unordered combinations in word problems',
    common_error_ru: 'Смешение формул размещений A(n,k) и сочетаний C(n,k) при анализе условия задачи'
  },
  {
    id: 'TOP-M9-7',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T7',
    order_num: 7,
    unit_en: 'Unit 5: Vectors & Coordinate Geometry',
    unit_ru: 'Раздел 5: Векторы на плоскости',
    title_en: 'Planar Vectors, Collinearity & Dot Product Operations',
    title_ru: 'Векторы на плоскости, коллинеарность и скалярное произведение',
    planned_hours: 16,
    cognitive_load: 2.0,
    prerequisite_topic_code: 'M9-T1',
    bloom_level: 'Comprehension',
    key_concepts_en: 'Vector coordinates, magnitude, scalar product angle cosine formula',
    key_concepts_ru: 'Координаты вектора, условие перпендикулярности, косинус угла через скалярное произведение',
    base_mastery: 86.4,
    std_dev: 8.4,
    common_error_en: 'Subtracting initial from terminal coordinates in reverse order',
    common_error_ru: 'Вычитание координат начала и конца вектора в обратном порядке'
  },
  {
    id: 'TOP-M9-8',
    subject_id: 'SUB-MATH-9',
    code: 'M9-T8',
    order_num: 8,
    unit_en: 'Unit 6: Applied Modeling',
    unit_ru: 'Раздел 6: Математическое моделирование',
    title_en: 'Mathematical Modeling of Motion, Work-Rate & Mixture Problems',
    title_ru: 'Математическое моделирование задач на движение, совместную работу и сплавы',
    planned_hours: 12,
    cognitive_load: 4.2,
    prerequisite_topic_code: 'M9-T2',
    bloom_level: 'Synthesis',
    key_concepts_en: 'System formulation from text constraints, concentration balance equations',
    key_concepts_ru: 'Составление дробно-рациональных моделей по тексту, баланс сухого вещества и производительности',
    base_mastery: 52.8,
    std_dev: 14.9,
    common_error_en: 'Adding times instead of rates in joint work problems (1/t1 + 1/t2 = 1/t)',
    common_error_ru: 'Сложение времени вместо производительностей (1/t1 + 1/t2) при составлении уравнения'
  },

  // Physics Grade 9 (Total: 68 hours)
  {
    id: 'TOP-P9-1',
    subject_id: 'SUB-PHYS-9',
    code: 'P9-T1',
    order_num: 1,
    unit_en: 'Unit 1: Kinematics & Rotational Motion',
    unit_ru: 'Раздел 1: Кинематика криволинейного движения',
    title_en: 'Projectile Motion, Centripetal Acceleration & Angular Velocity',
    title_ru: 'Движение тела под углом к горизонту и движение по окружности',
    planned_hours: 10,
    cognitive_load: 2.8,
    prerequisite_topic_code: null,
    bloom_level: 'Application',
    key_concepts_en: 'Vector velocity decomposition, centripetal acceleration v²/R, period & frequency',
    key_concepts_ru: 'Разложение вектора скорости на оси, центростремительное ускорение a = v²/R',
    base_mastery: 75.8,
    std_dev: 10.6,
    common_error_en: 'Using horizontal velocity component in vertical free-fall time equation',
    common_error_ru: 'Подстановка горизонтальной проекции скорости в уравнение вертикального перемещения'
  },
  {
    id: 'TOP-P9-2',
    subject_id: 'SUB-PHYS-9',
    code: 'P9-T2',
    order_num: 2,
    unit_en: 'Unit 2: Dynamics & Conservation Laws',
    unit_ru: 'Раздел 2: Динамика и законы сохранения',
    title_en: 'Universal Gravitation, Momentum Conservation & Elastic Collisions',
    title_ru: 'Закон всемирного тяготения, закон сохранения импульса и энергии при ударах',
    planned_hours: 12,
    cognitive_load: 3.2,
    prerequisite_topic_code: 'P9-T1',
    bloom_level: 'Analysis',
    key_concepts_en: 'Orbital velocity, vector momentum projection, inelastic vs elastic energy loss',
    key_concepts_ru: 'Первая космическая скорость, проекции импульса на оси при неупругом и упругом соударении',
    base_mastery: 71.2,
    std_dev: 11.9,
    common_error_en: 'Omission of negative sign for rebound momentum in 1D collision equations',
    common_error_ru: 'Потеря знака «минус» при проектировании импульса тела после отскока'
  },
  {
    id: 'TOP-P9-3',
    subject_id: 'SUB-PHYS-9',
    code: 'P9-T3',
    order_num: 3,
    unit_en: 'Unit 3: Oscillations & Waves',
    unit_ru: 'Раздел 3: Колебания и волны',
    title_en: 'Simple Harmonic Motion, Pendulum Dynamics & Wave Interference',
    title_ru: 'Гармонические колебания, математический маятник и резонанс волн',
    planned_hours: 8,
    cognitive_load: 4.1,
    prerequisite_topic_code: 'P9-T2',
    bloom_level: 'Analysis',
    key_concepts_en: 'Phase shift φ, Huygens principle, phase vs group velocity, energy oscillation',
    key_concepts_ru: 'Фаза колебаний, формула Томсона и Гюйгенса, разность хода и условие интерференции',
    base_mastery: 52.4,
    std_dev: 14.3,
    common_error_en: 'Confusing wave period T with spatial wavelength λ on displacement graphs',
    common_error_ru: 'Путаница между периодом T (по оси времени) и длиной волны λ (по оси координаты) на графиках'
  },
  {
    id: 'TOP-P9-4',
    subject_id: 'SUB-PHYS-9',
    code: 'P9-T4',
    order_num: 4,
    unit_en: 'Unit 4: Electromagnetism',
    unit_ru: 'Раздел 4: Электромагнитная индукция',
    title_en: 'Magnetic Flux, Faraday Induction Law & Lenz Polarity Rule',
    title_ru: 'Магнитный поток, закон электромагнитной индукции Фарадея и правило Ленца',
    planned_hours: 8,
    cognitive_load: 4.8,
    prerequisite_topic_code: 'P9-T2',
    bloom_level: 'Evaluation',
    key_concepts_en: 'Lorentz vs Ampere force, 3D right-hand/left-hand rule, induced EMF = -ΔΦ/Δt',
    key_concepts_ru: 'Сила Ампера и Лоренца, правило Ленца, ЭДС индукции при изменении магнитного потока',
    base_mastery: 43.5,
    std_dev: 16.2,
    common_error_en: 'Reversing induced current direction when external magnetic flux is decreasing',
    common_error_ru: 'Неверное определение направления индукционного тока по правилу Ленца при убывании потока Φ'
  },
  {
    id: 'TOP-P9-5',
    subject_id: 'SUB-PHYS-9',
    code: 'P9-T5',
    order_num: 5,
    unit_en: 'Unit 4: Electromagnetism',
    unit_ru: 'Раздел 4: Электромагнитная индукция',
    title_en: 'Alternating Current, Capacitive/Inductive Reactance & Transformers',
    title_ru: 'Переменный ток, индуктивное/емкостное сопротивление и трансформаторы',
    planned_hours: 8,
    cognitive_load: 4.0,
    prerequisite_topic_code: 'P9-T4',
    bloom_level: 'Analysis',
    key_concepts_en: 'RMS voltage/current (U_eff = U_max/√2), transformer turns ratio, power loss',
    key_concepts_ru: 'Действующее значение тока и напряжения, коэффициент трансформации и КПД линии передач',
    base_mastery: 53.9,
    std_dev: 13.7,
    common_error_en: 'Using peak amplitude instead of RMS values in AC Joule heating calculations',
    common_error_ru: 'Использование амплитудного значения вместо действующего при расчете мощности переменного тока'
  },
  {
    id: 'TOP-P9-6',
    subject_id: 'SUB-PHYS-9',
    code: 'P9-T6',
    order_num: 6,
    unit_en: 'Unit 5: Optics',
    unit_ru: 'Раздел 5: Геометрическая и волновая оптика',
    title_en: 'Refraction, Snell Law, Thin Lens Equation & Optical Dispersion',
    title_ru: 'Закон преломления Снеллиуса, тонкие линзы и дисперсия света',
    planned_hours: 12,
    cognitive_load: 2.1,
    prerequisite_topic_code: 'P9-T1',
    bloom_level: 'Comprehension',
    key_concepts_en: 'Total internal reflection, virtual vs real images, optical power D = 1/F',
    key_concepts_ru: 'Полное внутреннее отражение, формула тонкой линзы 1/F = 1/d ± 1/f, оптическая сила',
    base_mastery: 85.6,
    std_dev: 8.9,
    common_error_en: 'Sign convention error for diverging lens focal length and virtual image distance',
    common_error_ru: 'Ошибка в знаке фокусного расстояния рассеивающей линзы и мнимого изображения'
  },
  {
    id: 'TOP-P9-7',
    subject_id: 'SUB-PHYS-9',
    code: 'P9-T7',
    order_num: 7,
    unit_en: 'Unit 6: Quantum & Nuclear Physics',
    unit_ru: 'Раздел 6: Квантовая и ядерная физика',
    title_en: 'Photoelectric Effect, Mass Defect, Nuclear Binding Energy & Decay Chains',
    title_ru: 'Фотоэффект, дефект масс, энергия связи ядра и радиоактивный распад',
    planned_hours: 10,
    cognitive_load: 3.9,
    prerequisite_topic_code: 'P9-T2',
    bloom_level: 'Analysis',
    key_concepts_en: 'Einstein photoelectric equation, red boundary, half-life N = N0 * 2^(-t/T)',
    key_concepts_ru: 'Уравнение Эйнштейна для фотоэффекта, красная граница, дефект масс и закон полураспада',
    base_mastery: 56.9,
    std_dev: 13.8,
    common_error_en: 'Unit mismatch between electron-volts (eV) and Joules (J) when computing stopping potential',
    common_error_ru: 'Неперевод электрон-вольт (эВ) в Джоули (Дж) при расчете задерживающего напряжения'
  },

  // Chemistry Grade 9 (Total: 68 hours)
  {
    id: 'TOP-C9-1',
    subject_id: 'SUB-CHEM-9',
    code: 'C9-T1',
    order_num: 1,
    unit_en: 'Unit 1: Electrolytic Solutions',
    unit_ru: 'Раздел 1: Электролитическая диссоциация',
    title_en: 'Electrolytic Dissociation, Net Ionic Equations & Salt Hydrolysis',
    title_ru: 'Электролитическая диссоциация, ионные уравнения и гидролиз солей',
    planned_hours: 12,
    cognitive_load: 2.7,
    prerequisite_topic_code: null,
    bloom_level: 'Application',
    key_concepts_en: 'Strong vs weak electrolytes, pH indicators in salt hydrolysis, precipitate rules',
    key_concepts_ru: 'Сильные и слабые электролиты, сокращенные ионные уравнения, среда раствора при гидролизе',
    base_mastery: 77.6,
    std_dev: 10.4,
    common_error_en: 'Splitting weak electrolytes or insoluble precipitates into ions in net ionic equations',
    common_error_ru: 'Запись слабых электролитов и нерастворимых осадков в диссоциированном ионном виде'
  },
  {
    id: 'TOP-C9-2',
    subject_id: 'SUB-CHEM-9',
    code: 'C9-T2',
    order_num: 2,
    unit_en: 'Unit 2: Redox & Electrochemistry',
    unit_ru: 'Раздел 2: Окислительно-восстановительные реакции',
    title_en: 'Redox Reactions, Electron-Ion Balance & Electrolysis Processes',
    title_ru: 'Окислительно-восстановительные реакции, метод электронного баланса и электролиз',
    planned_hours: 10,
    cognitive_load: 4.7,
    prerequisite_topic_code: 'C9-T1',
    bloom_level: 'Evaluation',
    key_concepts_en: 'Oxidation state shifts, oxidizing vs reducing agents, cathode/anode discharge competition',
    key_concepts_ru: 'Степени окисления, электронный баланс, конкурирующие процессы на катоде и аноде при электролизе',
    base_mastery: 46.2,
    std_dev: 15.9,
    common_error_en: 'Predicting metal reduction instead of hydrogen evolution during aqueous electrolysis of active metals',
    common_error_ru: 'Выделение активного металла вместо водорода на катоде при электролизе водного раствора соли'
  },
  {
    id: 'TOP-C9-3',
    subject_id: 'SUB-CHEM-9',
    code: 'C9-T3',
    order_num: 3,
    unit_en: 'Unit 3: Kinetics & Equilibrium',
    unit_ru: 'Раздел 3: Химическая кинетика и равновесие',
    title_en: 'Reaction Rate Law, Activation Energy & Le Chatelier Equilibrium Shifts',
    title_ru: 'Скорость химических реакций, закон действующих масс и принцип Ле Шателье',
    planned_hours: 10,
    cognitive_load: 4.3,
    prerequisite_topic_code: 'C9-T1',
    bloom_level: 'Analysis',
    key_concepts_en: 'Van’t Hoff temperature rule, heterogeneous solids exclusion, pressure-volume shifts',
    key_concepts_ru: 'Правило Вант-Гоффа, учет агрегатного состояния веществ, смещение равновесия от давления и T',
    base_mastery: 51.5,
    std_dev: 14.6,
    common_error_en: 'Including solid-phase reactant concentrations in gas-phase rate law expressions',
    common_error_ru: 'Включение концентрации твердых веществ в кинетическое уравнение скорости гетерогенной реакции'
  },
  {
    id: 'TOP-C9-4',
    subject_id: 'SUB-CHEM-9',
    code: 'C9-T4',
    order_num: 4,
    unit_en: 'Unit 4: Chemistry of Non-Metals',
    unit_ru: 'Раздел 4: Химия элементов-неметаллов',
    title_en: 'Halogens, Sulfur Compounds, Nitrogen Cycle & Phosphorus Allotropes',
    title_ru: 'Галогены, соединения серы, азота, фосфора и углерода',
    planned_hours: 14,
    cognitive_load: 2.3,
    prerequisite_topic_code: 'C9-T2',
    bloom_level: 'Comprehension',
    key_concepts_en: 'Concentrated vs dilute H2SO4 and HNO3 oxidizing behavior, qualitative ion tests',
    key_concepts_ru: 'Особые свойства концентрированных H2SO4 и HNO3, качественные реакции на анионы',
    base_mastery: 83.4,
    std_dev: 9.1,
    common_error_en: 'Assuming hydrogen gas evolution when metals react with nitric acid (HNO3)',
    common_error_ru: 'Запись выделения чистого водорода H2 при взаимодействии металлов с азотной кислотой HNO3'
  },
  {
    id: 'TOP-C9-5',
    subject_id: 'SUB-CHEM-9',
    code: 'C9-T5',
    order_num: 5,
    unit_en: 'Unit 5: Chemistry of Metals',
    unit_ru: 'Раздел 5: Металлы и сплавы',
    title_en: 'Alkali, Alkaline-Earth, Amphoteric Aluminum & d-Block Transition Metals',
    title_ru: 'Щелочные, щелочноземельные металлы, амфотерность алюминия и железо',
    planned_hours: 12,
    cognitive_load: 2.4,
    prerequisite_topic_code: 'C9-T1',
    bloom_level: 'Comprehension',
    key_concepts_en: 'Amphoteric hydroxides [Al(OH)4]-, water hardness removal, corrosion prevention',
    key_concepts_ru: 'Амфотерность оксида и гидроксида алюминия и цинка, жесткость воды и способы ее устранения',
    base_mastery: 81.9,
    std_dev: 9.5,
    common_error_en: 'Incomplete neutralization vs complex salt formation when excess NaOH reacts with AlCl3',
    common_error_ru: 'Неучет растворения осадка Al(OH)3 с образованием комплексной соли в избытке щелочи'
  },
  {
    id: 'TOP-C9-6',
    subject_id: 'SUB-CHEM-9',
    code: 'C9-T6',
    order_num: 6,
    unit_en: 'Unit 6: Introduction to Organic Chemistry',
    unit_ru: 'Раздел 6: Введение в органическую химию',
    title_en: 'Homologous Hydrocarbons, Structural Isomerism & Functional Groups',
    title_ru: 'Гомологические ряды углеводородов, структурная изомерия и функциональные группы',
    planned_hours: 10,
    cognitive_load: 4.0,
    prerequisite_topic_code: 'C9-T4',
    bloom_level: 'Synthesis',
    key_concepts_en: 'IUPAC nomenclature, sp3/sp2/sp hybridization, cis-trans and chain isomerism',
    key_concepts_ru: 'Номенклатура ИЮПАК, структурная и пространственная изомерия алкенов и алканов',
    base_mastery: 55.1,
    std_dev: 14.0,
    common_error_en: 'Selecting a non-maximal carbon chain when assigning IUPAC substituent locants',
    common_error_ru: 'Неверный выбор главной углеродной цепи и направления нумерации локантов по ИЮПАК'
  },

  // Computer Science Grade 9 (Total: 34 hours)
  {
    id: 'TOP-CS9-1',
    subject_id: 'SUB-CS-9',
    code: 'CS9-T1',
    order_num: 1,
    unit_en: 'Unit 1: Architecture & Boolean Logic',
    unit_ru: 'Раздел 1: Кодирование и булева логика',
    title_en: 'Information Encoding, De Morgan Laws & Logic Gate Circuits',
    title_ru: 'Кодирование информации, законы Де Моргана и логические схемы',
    planned_hours: 6,
    cognitive_load: 1.9,
    prerequisite_topic_code: null,
    bloom_level: 'Comprehension',
    key_concepts_en: 'Truth tables, NAND/NOR simplification, bitwise operations',
    key_concepts_ru: 'Таблицы истинности, упрощение логических выражений по законам Де Моргана',
    base_mastery: 88.2,
    std_dev: 7.8,
    common_error_en: 'Forgetting to invert conjunction to disjunction when applying De Morgan negation',
    common_error_ru: 'Сохранение знака конъюнкции вместо замены на дизъюнкцию при раскрытии общей инверсии'
  },
  {
    id: 'TOP-CS9-2',
    subject_id: 'SUB-CS-9',
    code: 'CS9-T2',
    order_num: 2,
    unit_en: 'Unit 2: Data Structures in Python',
    unit_ru: 'Раздел 2: Двумерные массивы и матрицы',
    title_en: 'Two-Dimensional Arrays, Matrix Traversal & Diagonal Transformations',
    title_ru: 'Двумерные списки (матрицы) в Python, обход диагоналей и транспонирование',
    planned_hours: 6,
    cognitive_load: 4.1,
    prerequisite_topic_code: 'CS9-T1',
    bloom_level: 'Analysis',
    key_concepts_en: 'Nested loop indexing [i][j], secondary diagonal i + j == n - 1, shallow copy pitfalls',
    key_concepts_ru: 'Вложенные циклы A[i][j], условие побочной диагонали i + j == n - 1, генераторы матриц',
    base_mastery: 52.9,
    std_dev: 14.8,
    common_error_en: 'Creating aliased rows via [[0]*m]*n and off-by-one indexing on anti-diagonal',
    common_error_ru: 'Клонирование ссылок на одну строку через [[0]*m]*n и ошибка индекса побочной диагонали'
  },
  {
    id: 'TOP-CS9-3',
    subject_id: 'SUB-CS-9',
    code: 'CS9-T3',
    order_num: 3,
    unit_en: 'Unit 3: Algorithmic Complexity',
    unit_ru: 'Раздел 3: Алгоритмы сортировки и поиска',
    title_en: 'Binary Search, Merge/Quick Sort & Asymptotic Time Complexity O(n log n)',
    title_ru: 'Бинарный поиск, быстрая сортировка и оценка сложности алгоритмов Big-O',
    planned_hours: 6,
    cognitive_load: 4.6,
    prerequisite_topic_code: 'CS9-T2',
    bloom_level: 'Evaluation',
    key_concepts_en: 'Loop invariants, binary search boundary mid=(L+R)//2, O(n²) vs O(n log n)',
    key_concepts_ru: 'Инвариант бинарного поиска, сдвиг границ L и R, сравнение O(n²) и O(n log n)',
    base_mastery: 45.8,
    std_dev: 15.6,
    common_error_en: 'Infinite loop in binary search due to unshifted midpoint boundary (L = mid instead of mid + 1)',
    common_error_ru: 'Зацикливание бинарного поиска из-за некорректного обновления границы L = mid вместо mid + 1'
  },
  {
    id: 'TOP-CS9-4',
    subject_id: 'SUB-CS-9',
    code: 'CS9-T4',
    order_num: 4,
    unit_en: 'Unit 3: Algorithmic Complexity',
    unit_ru: 'Раздел 3: Алгоритмы сортировки и поиска',
    title_en: 'Recursive Algorithms, Call Stack Frames & Memoization',
    title_ru: 'Рекурсивные алгоритмы, стек вызовов, базовый случай и мемоизация',
    planned_hours: 4,
    cognitive_load: 4.9,
    prerequisite_topic_code: 'CS9-T3',
    bloom_level: 'Synthesis',
    key_concepts_en: 'Base termination case, stack unwinding order, exponential tree pruning',
    key_concepts_ru: 'Терминальная ветка рекурсии, порядок раскрутки стека вызовов, кэширование состояний',
    base_mastery: 41.2,
    std_dev: 16.9,
    common_error_en: 'Missing return statement on recursive branch or stack overflow on boundary input n=0',
    common_error_ru: 'Пропуск оператора return в рекурсивной ветке и переполнение стека из-за неверного базового случая'
  },
  {
    id: 'TOP-CS9-5',
    subject_id: 'SUB-CS-9',
    code: 'CS9-T5',
    order_num: 5,
    unit_en: 'Unit 4: Databases & Data Science',
    unit_ru: 'Раздел 4: Реляционные базы данных и ИИ',
    title_en: 'Relational Normalization, Primary/Foreign Keys & Multi-Table SQL Joins',
    title_ru: 'Реляционные базы данных, нормализация ключей и агрегатные запросы SQL',
    planned_hours: 6,
    cognitive_load: 2.9,
    prerequisite_topic_code: 'CS9-T1',
    bloom_level: 'Application',
    key_concepts_en: 'INNER/LEFT JOIN, GROUP BY with HAVING vs WHERE filtering',
    key_concepts_ru: 'Связи таблиц PK/FK, объединения INNER JOIN и фильтрация агрегатов через HAVING',
    base_mastery: 74.8,
    std_dev: 11.2,
    common_error_en: 'Placing aggregate functions like AVG() or COUNT() inside WHERE instead of HAVING clause',
    common_error_ru: 'Использование агрегатных функций COUNT/AVG внутри секции WHERE вместо HAVING'
  },
  {
    id: 'TOP-CS9-6',
    subject_id: 'SUB-CS-9',
    code: 'CS9-T6',
    order_num: 6,
    unit_en: 'Unit 4: Databases & Data Science',
    unit_ru: 'Раздел 4: Реляционные базы данных и ИИ',
    title_en: 'Exploratory Data Analysis, Linear Regression & Classification Metrics',
    title_ru: 'Анализ табличных данных, линейная регрессия и метрики машинного обучения',
    planned_hours: 6,
    cognitive_load: 2.6,
    prerequisite_topic_code: 'CS9-T5',
    bloom_level: 'Application',
    key_concepts_en: 'Train/test split, overfitting, confusion matrix precision & recall',
    key_concepts_ru: 'Разделение выборки train/test, переобучение модели, матрица ошибок (Precision/Recall)',
    base_mastery: 79.4,
    std_dev: 9.9,
    common_error_en: 'Evaluating model accuracy on training data without holdout validation split',
    common_error_ru: 'Оценка точности модели на обучающей выборке без выделения тестового набора'
  }
];

export const DEMO_CLASSES = [
  // Mathematics Classes (4 classes across 3 textbooks)
  {
    id: 'CLS-9A-MATH',
    subject_id: 'SUB-MATH-9',
    name: '9-A (STEM Lyceum #1)',
    grade: 9,
    school_name: 'Taraz Regional STEM Lyceum #1',
    teacher_name: 'Aigerim Suleimenova',
    textbook_id: 'TB-MATH-MEKTEP',
    student_count: 28,
    aptitude_offset: +3.5,
    profile_en: 'STEM-focused cohort piloting Mektep Unified Algebra 9',
    profile_ru: 'Профильный физико-математический класс (учебник «Мектеп»)'
  },
  {
    id: 'CLS-9B-MATH',
    subject_id: 'SUB-MATH-9',
    name: '9-B (Gymnasium #8)',
    grade: 9,
    school_name: 'Zhambyl Classical Gymnasium #8',
    teacher_name: 'Marat Kassymov',
    textbook_id: 'TB-MATH-ALMATY',
    student_count: 28,
    aptitude_offset: +0.5,
    profile_en: 'General academic track using AlmatyKitap Theoretical Algebra 9',
    profile_ru: 'Общеобразовательный академический поток (учебник «Алматыкітап»)'
  },
  {
    id: 'CLS-9C-MATH',
    subject_id: 'SUB-MATH-9',
    name: '9-C (Comprehensive School #24)',
    grade: 9,
    school_name: 'City Secondary School #24',
    teacher_name: 'Gulmira Ospanova',
    textbook_id: 'TB-MATH-ATAMURA',
    student_count: 28,
    aptitude_offset: -1.0,
    profile_en: 'Applied mathematics track using Atamura STEM Edition',
    profile_ru: 'Прикладной профиль (учебник «Атамұра»)'
  },
  {
    id: 'CLS-9D-MATH',
    subject_id: 'SUB-MATH-9',
    name: '9-D (Comprehensive School #45)',
    grade: 9,
    school_name: 'District Secondary School #45',
    teacher_name: 'Yerlan Bekbosynov',
    textbook_id: 'TB-MATH-ALMATY',
    student_count: 28,
    aptitude_offset: -2.5,
    profile_en: 'Standard curriculum track using AlmatyKitap Theoretical Algebra 9',
    profile_ru: 'Базовый общеобразовательный поток (учебник «Алматыкітап»)'
  },

  // Physics Classes (3 classes across 3 textbooks)
  {
    id: 'CLS-9A-PHYS',
    subject_id: 'SUB-PHYS-9',
    name: '9-A (STEM Lyceum #1)',
    grade: 9,
    school_name: 'Taraz Regional STEM Lyceum #1',
    teacher_name: 'Bauyrzhan Nurpeisov',
    textbook_id: 'TB-PHYS-MEKTEP',
    student_count: 28,
    aptitude_offset: +2.8,
    profile_en: 'Experimental physics track using Mektep Conceptual Physics 9',
    profile_ru: 'Экспериментальный физический профиль (учебник «Мектеп»)'
  },
  {
    id: 'CLS-9B-PHYS',
    subject_id: 'SUB-PHYS-9',
    name: '9-B (Gymnasium #8)',
    grade: 9,
    school_name: 'Zhambyl Classical Gymnasium #8',
    teacher_name: 'Svetlana Kim',
    textbook_id: 'TB-PHYS-ATAMURA',
    student_count: 28,
    aptitude_offset: -0.8,
    profile_en: 'General track using Atamura Classical Mechanics 9',
    profile_ru: 'Общеобразовательный поток (учебник «Атамұра»)'
  },
  {
    id: 'CLS-9E-PHYS',
    subject_id: 'SUB-PHYS-9',
    name: '9-E (IT Lyceum #12)',
    grade: 9,
    school_name: 'Regional IT Lyceum #12',
    teacher_name: 'Askhat Tulegenov',
    textbook_id: 'TB-PHYS-ARMAN',
    student_count: 28,
    aptitude_offset: +1.5,
    profile_en: 'Problem-solving cohort using Arman-PV Physics 9',
    profile_ru: 'Инженерный поток (учебник «Арман-ПВ»)'
  },

  // Chemistry Classes (2 classes across 2 textbooks)
  {
    id: 'CLS-9A-CHEM',
    subject_id: 'SUB-CHEM-9',
    name: '9-A (Bio-Chem Gymnasium #15)',
    grade: 9,
    school_name: 'School-Gymnasium #15',
    teacher_name: 'Dinara Akhmetova',
    textbook_id: 'TB-CHEM-MEKTEP',
    student_count: 28,
    aptitude_offset: +1.8,
    profile_en: 'Natural sciences cohort using Mektep Structural Chemistry 9',
    profile_ru: 'Естественно-научный поток (учебник «Мектеп»)'
  },
  {
    id: 'CLS-9C-CHEM',
    subject_id: 'SUB-CHEM-9',
    name: '9-C (Comprehensive School #24)',
    grade: 9,
    school_name: 'City Secondary School #24',
    teacher_name: 'Roza Baitursynova',
    textbook_id: 'TB-CHEM-ATAMURA',
    student_count: 28,
    aptitude_offset: -1.5,
    profile_en: 'Standard track using Atamura General Chemistry 9',
    profile_ru: 'Базовый поток (учебник «Атамұра»)'
  },

  // Computer Science Classes (2 classes across 2 textbooks)
  {
    id: 'CLS-9E-CS',
    subject_id: 'SUB-CS-9',
    name: '9-E (IT Lyceum #12)',
    grade: 9,
    school_name: 'Regional IT Lyceum #12',
    teacher_name: 'Timur Zhanabayev',
    textbook_id: 'TB-CS-ARMAN',
    student_count: 28,
    aptitude_offset: +2.5,
    profile_en: 'Coding & algorithms cohort using Arman-PV Python 9',
    profile_ru: 'IT-профиль с углубленным Python (учебник «Арман-ПВ»)'
  },
  {
    id: 'CLS-9D-CS',
    subject_id: 'SUB-CS-9',
    name: '9-D (Comprehensive School #45)',
    grade: 9,
    school_name: 'District Secondary School #45',
    teacher_name: 'Aliya Nurgalieva',
    textbook_id: 'TB-CS-ALMATY',
    student_count: 28,
    aptitude_offset: -1.8,
    profile_en: 'General informatics track using AlmatyKitap Informatics 9',
    profile_ru: 'Базовый поток информатики (учебник «Алматыкітап»)'
  }
];

const FIRST_NAMES = [
  'Alikhan', 'Aruzhan', 'Sanzhar', 'Madina', 'Nurasyl', 'Ayaulym', 'Yerasyl', 'Diana',
  'Miras', 'Kamila', 'Amir', 'Amina', 'Dias', 'Tomiris', 'Arsen', 'Inzhu',
  'Timur', 'alina', 'Aldiyar', 'Sofiya', 'Beksultan', 'Aisulu', 'Mansur', 'Zere',
  'Daniyar', 'Malika', 'Ruslan', 'Adeliya'
];

const LAST_NAMES = [
  'Saparov', 'Nurgaliyeva', 'Kassymov', 'Ospanova', 'Tulegenov', 'Akhmetova', 'Bekturov', 'Suleimenova',
  'Zhumabayev', 'Ibrayeva', 'Mukhamedzhanov', 'Kenzhebayeva', 'Alimov', 'Tastanova', 'Serikov', 'Duisenova',
  'Rakhimov', 'Bazarbayeva', 'Omarov', 'Kurmangaliyeva', 'Yermekov', 'Sadykova', 'Abdrakhmanov', 'Zhakupova',
  'Bolatov', 'Smagulova', 'Karimov', 'Kuanysheva'
];

export function generateSyntheticDataset() {
  const rng = createRng(20261109);
  const students = [];
  const assessments = [];

  const textbooksById = new Map(DEMO_TEXTBOOKS.map((t) => [t.id, t]));
  const topicsBySubject = new Map();
  for (const topic of DEMO_TOPICS) {
    if (!topicsBySubject.has(topic.subject_id)) {
      topicsBySubject.set(topic.subject_id, []);
    }
    topicsBySubject.get(topic.subject_id).push(topic);
  }

  let assessmentSeq = 1;

  for (let cIdx = 0; cIdx < DEMO_CLASSES.length; cIdx++) {
    const cls = DEMO_CLASSES[cIdx];
    const textbook = textbooksById.get(cls.textbook_id);
    const subjectTopics = topicsBySubject.get(cls.subject_id) || [];

    for (let sIdx = 0; sIdx < cls.student_count; sIdx++) {
      const studentId = `STU-${cls.id}-${String(sIdx + 1).padStart(2, '0')}`;
      const fName = FIRST_NAMES[(sIdx + cIdx * 3) % FIRST_NAMES.length];
      const fNameCapitalized = fName.charAt(0).toUpperCase() + fName.slice(1);
      const lName = LAST_NAMES[(sIdx * 5 + cIdx * 7) % LAST_NAMES.length];

      // Student individual aptitude distributed around 0 (-16 to +16)
      const studentAptitude = clamp(normalRandom(rng, cls.aptitude_offset, 7.5), -18, 18);
      const attendanceRate = clamp(Math.round(92 + studentAptitude * 0.25 + normalRandom(rng, 0, 2.5)), 76, 100);

      students.push({
        id: studentId,
        class_id: cls.id,
        student_code: `KZ-${cls.grade}${String(cIdx + 1).padStart(2, '0')}-${String(sIdx + 1).padStart(3, '0')}`,
        full_name: `${fNameCapitalized} ${lName}`,
        baseline_aptitude: Number(studentAptitude.toFixed(1)),
        attendance_rate: attendanceRate
      });

      for (const topic of subjectTopics) {
        const tbModifier = textbook?.topic_Search_Modifiers?.[topic.code] || 0;
        // High cognitive load amplifies student aptitude differences and textbook quality impact
        const noise = normalRandom(rng, 0, topic.std_dev * 0.58);
        const rawPct = topic.base_mastery + tbModifier + studentAptitude * (0.65 + topic.cognitive_load * 0.06) + noise;
        const scorePct = Number(clamp(rawPct, 18, 100).toFixed(1));

        const maxScore = 25;
        const rawScore = Math.round((scorePct / 100) * maxScore);

        // Sub-skill breakdown: Conceptual, Procedural, Applied
        const conceptualScore = Number(
          clamp(scorePct + (textbook.readability_score - 80) * 0.35 + normalRandom(rng, 0, 4.5), 15, 100).toFixed(1)
        );
        const proceduralScore = Number(
          clamp(scorePct + (textbook.practice_density - 84) * 0.35 + normalRandom(rng, 0, 4.5), 15, 100).toFixed(1)
        );
        const appliedScore = Number(
          clamp(scorePct - (topic.cognitive_load - 3.0) * 3.8 + normalRandom(rng, 0, 5.2), 12, 100).toFixed(1)
        );

        const timeSpentMin = Math.round(
          clamp(28 + topic.cognitive_load * 4.2 - (scorePct - 65) * 0.14 + normalRandom(rng, 0, 3.5), 15, 60)
        );
        const attemptCount = scorePct < 50 ? (rng() > 0.35 ? 2 : 3) : scorePct < 68 ? (rng() > 0.65 ? 2 : 1) : 1;

        assessments.push({
          id: `ASM-${String(assessmentSeq++).padStart(5, '0')}`,
          student_id: studentId,
          class_id: cls.id,
          subject_id: cls.subject_id,
          topic_id: topic.id,
          textbook_id: cls.textbook_id,
          score_pct: scorePct,
          max_score: maxScore,
          raw_score: rawScore,
          time_spent_min: timeSpentMin,
          attempt_count: attemptCount,
          conceptual_score: conceptualScore,
          procedural_score: proceduralScore,
          applied_score: appliedScore,
          error_tag: scorePct < 62 ? topic.common_error_en : 'None / Minor arithmetic slip',
          assessed_at: `2026-0${Math.min(5, Math.ceil(topic.order_num / 2))}-15`
        });
      }
    }
  }

  return {
    dataset: {
      id: 'DS-SYNTHETIC-DEMO',
      name_en: 'Zhambyl Region Grade 9 Benchmark (Synthetic Demonstration Data)',
      name_ru: 'Региональный срез 9 классов (Демонстрационные синтетические данные)',
      is_synthetic: 1,
      record_count: assessments.length,
      created_at: '2026-11-09T08:00:00Z',
      notes_en: 'Clearly marked synthetic demonstration dataset modeling 308 students across 11 classes, 4 subjects, 10 textbooks, and 27 curriculum topics.'
    },
    subjects: DEMO_SUBJECTS,
    textbooks: DEMO_TEXTBOOKS,
    topics: DEMO_TOPICS,
    classes: DEMO_CLASSES,
    students,
    assessments
  };
}
