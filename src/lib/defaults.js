// Default structure (no personal data is invented: schedule, balance, income
// and physical goals all start empty).

export const DEFAULT_CATEGORIES = [
  { id: 'etudes', name: 'Études & révisions', color: '#7A2E3A', space: 'etudes', rank: 1 },
  { id: 'glowup', name: 'Confiance & Glow up', color: '#C48A86', space: 'glowup', rank: 2 },
  { id: 'social', name: 'Vie sociale', color: '#B4775A', space: 'social', rank: 3 },
  { id: 'projets', name: 'Projets & business', color: '#6A5A8C', space: 'projets', rank: 4 },
  { id: 'finances', name: 'Budget & finances', color: '#A8844E', space: 'finances', rank: 5 },
  { id: 'perso', name: 'Vie personnelle', color: '#5B6B8C', space: 'perso', rank: 6 },
  { id: 'sport', name: 'Sport & forme', color: '#4F7A65', space: 'sport', rank: 7 },
  { id: 'beaute', name: 'Beauté & soins', color: '#A97683', space: 'beaute', rank: 8 },
  { id: 'carriere', name: 'Emploi & carrière', color: '#3E5C76', space: 'carriere', rank: 9 },
  { id: 'langues', name: 'Langues', color: '#8C6A4F', space: 'langues', rank: 10 },
  { id: 'habitudes', name: 'Sommeil & habitudes', color: '#5E7F8A', space: 'habitudes', rank: 11 },
  { id: 'lecture', name: 'Lecture & développement', color: '#7D6B57', space: 'lecture', rank: 12 },
];

export const DEFAULT_SUBJECTS = [
  { id: 'sub-compta', name: 'Comptabilité et diagnostic financier', color: '#7A2E3A', reinforced: true },
  { id: 'sub-eco', name: 'Économie', color: '#3E5C76', reinforced: false },
  { id: 'sub-maths', name: 'Mathématiques de gestion', color: '#6A5A8C', reinforced: true },
  { id: 'sub-droit', name: 'Sources et principes du droit', color: '#A8844E', reinforced: false },
  { id: 'sub-anglais', name: 'Anglais', color: '#4F7A65', reinforced: false },
  { id: 'sub-espagnol', name: 'Espagnol', color: '#B4775A', reinforced: false },
  { id: 'sub-seminaire', name: 'Séminaire de travail universitaire', color: '#5E7F8A', reinforced: false },
];

export const DEFAULT_LANGUAGES = [
  { id: 'lang-en', name: 'Anglais', weeklyGoalMin: null, notes: {} },
  { id: 'lang-es', name: 'Espagnol', weeklyGoalMin: null, notes: {} },
];

export const LANGUAGE_SKILLS = [
  ['vocabulaire', 'Vocabulaire'], ['grammaire', 'Grammaire'], ['conjugaison', 'Conjugaison'],
  ['exercices', 'Exercices'], ['oral', 'Compréhension orale'], ['ecrit', 'Compréhension écrite'], ['cours', 'Notes de cours'],
];

export const FINANCE_CATEGORIES = [
  'Courses', 'Transport', 'Études', 'Beauté', 'Vêtements', 'Restaurants', 'Loisirs', 'Abonnements', 'Épargne', 'Autres',
];

// Types of calendar entries. `task: true` means it is something to accomplish
// (it stays visible until validated); events simply happen.
export const ITEM_TYPES = [
  { id: 'tache', label: 'Tâche', task: true },
  { id: 'revision', label: 'Séance de révision', task: true, study: true },
  { id: 'exercices', label: 'Exercices', task: true, study: true },
  { id: 'travail', label: 'Travail universitaire', task: true, study: true },
  { id: 'echeance', label: 'Échéance / travail à rendre', task: true, deadline: true },
  { id: 'cours', label: 'Cours magistral', course: true },
  { id: 'tp', label: 'Travaux pratiques', course: true },
  { id: 'remediation', label: 'Séance de remédiation', course: true },
  { id: 'interro', label: 'Interrogation', exam: true },
  { id: 'examen', label: 'Examen', exam: true },
  { id: 'seance', label: 'Séance de sport', task: true },
  { id: 'rdv', label: 'Rendez-vous' },
  { id: 'evenement', label: 'Événement' },
  { id: 'sortie', label: 'Sortie' },
  { id: 'invitation', label: 'Invitation' },
  { id: 'demarche', label: 'Démarche administrative', task: true },
  { id: 'menage', label: 'Tâche ménagère', task: true },
  { id: 'langue', label: 'Apprentissage de langue', task: true },
  { id: 'lecture', label: 'Lecture', task: true },
  { id: 'routine', label: 'Routine', task: true },
];
export const TYPE = Object.fromEntries(ITEM_TYPES.map((t) => [t.id, t]));
export const isTaskType = (type) => !!TYPE[type]?.task || !TYPE[type];
export const isStudyType = (type) => !!TYPE[type]?.study;

export const PRIORITIES = [
  { id: 'fixe', label: 'Obligation fixe', plural: 'Obligations fixes', short: 'Fixe' },
  { id: 'haute', label: 'Priorité importante', plural: 'Priorités importantes', short: 'Important' },
  { id: 'secondaire', label: 'Objectif secondaire', plural: 'Objectifs secondaires', short: 'Secondaire' },
  { id: 'facultatif', label: 'Activité facultative', plural: 'Activités facultatives', short: 'Facultatif' },
];

export const CHAPTER_STATUS = [
  { id: 'a_faire', label: 'À étudier' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'etudie', label: 'Étudié' },
  { id: 'a_revoir', label: 'À revoir' },
];

export const JOB_STATUS = [
  { id: 'reperee', label: 'Offre repérée' },
  { id: 'envoyee', label: 'Candidature envoyée' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'attente', label: 'En attente de réponse' },
  { id: 'acceptee', label: 'Acceptée' },
  { id: 'refusee', label: 'Refusée' },
];

export const ROUTINE_KINDS = [
  ['matin', 'Routine du matin'], ['soir', 'Routine du soir'], ['skincare', 'Skincare'], ['cheveux', 'Soins des cheveux'],
  ['corps', 'Soins du corps'], ['beaute', 'Beauté'], ['autre', 'Autre'],
];

export const QUOTES = [
  { text: 'Little by little, one travels far.', author: 'Proverbe' },
  { text: 'Well begun is half done.', author: 'Aristotle' },
  { text: 'What we learn with pleasure we never forget.', author: 'Alfred Mercier' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  { text: 'The beautiful thing about learning is that no one can take it away from you.', author: 'B. B. King' },
  { text: 'Be patient with yourself. Nothing in nature blooms all year.', author: 'Anonyme' },
  { text: 'Slow progress is still progress.', author: 'Anonyme' },
  { text: 'A room without books is like a body without a soul.', author: 'Cicero' },
];

export const DEFAULT_AFFIRMATIONS = [
  "J'avance à mon rythme, et chaque petit pas compte.",
  "Je mérite de prendre soin de moi.",
  "Je suis capable de comprendre ce qui me semble difficile aujourd'hui.",
];

export function defaultSettings() {
  return {
    id: 'main',
    appName: 'Life Planner',
    theme: 'auto',
    categories: DEFAULT_CATEGORIES,
    // Study windows she said she has (afternoon / evening). Fully editable, used
    // only by the suggestion engine — never to place anything automatically.
    availability: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [
      { start: '14:00', end: '18:30' },
      { start: '19:30', end: '22:00' },
    ]])),
    planning: { sessionMin: 60, breakMin: 15, maxStudyMinPerDay: 180, keepFreeMin: 60, restDays: [] },
    academicYears: [],
    notifications: {
      enabled: false,
      exams: true, deadlines: true, rdv: true, habits: false, goals: false, items: true,
      examLeadDays: 3, deadlineLeadDays: 1, maxPerDay: 6,
    },
    affirmations: DEFAULT_AFFIRMATIONS,
    quotes: QUOTES,
    finance: { initialBalance: null, initialBalanceDate: null, monthlyBudget: null, limits: {}, categories: FINANCE_CATEGORIES },
    readingGoalPerYear: null,
    createdAt: Date.now(),
  };
}

export function seedEntries() {
  return [
    ['settings', defaultSettings()],
    ...DEFAULT_SUBJECTS.map((s, i) => ['subjects', { ...s, rank: i, weeklyGoalMin: null, chapters: [], exercises: [], notions: [], notes: '', objective: '' }]),
    ...DEFAULT_LANGUAGES.map((l) => ['languages', l]),
    ['projects', { id: 'proj-etsy', name: 'Projet Etsy', description: '', objectives: '', status: 'idee', steps: [], ideas: '', notes: '', links: [], deadline: null, createdAt: Date.now() }],
  ];
}
