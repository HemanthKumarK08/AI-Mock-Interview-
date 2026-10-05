// Controlled interview options and validation standards for MockInterviewAI

const ALLOWED_TARGET_ROLES = [
  'Software Engineer',
  'Java Developer',
  'Python Developer',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer'
];

const ALLOWED_INTERVIEW_TYPES = [
  'technical',
  'hr',
  'behavioral',
  'mixed'
];

const ALLOWED_DIFFICULTIES = [
  'beginner',
  'intermediate',
  'advanced'
];

const ALLOWED_INTERVIEW_MODES = [
  'text',
  'voice'
];

const ALLOWED_QUESTION_COUNTS = [5, 10, 15, 20];

const ALLOWED_DURATIONS_MINUTES = [15, 30, 45, 60];

const ALLOWED_STATUSES = [
  'created',
  'ready',
  'in_progress',
  'paused',
  'completed',
  'cancelled'
];

const ALLOWED_TRANSITIONS = {
  'created': ['ready'],
  'ready': ['in_progress', 'cancelled'],
  'in_progress': ['paused', 'completed', 'cancelled'],
  'paused': ['in_progress', 'cancelled'],
  'completed': [],
  'cancelled': []
};

module.exports = {
  ALLOWED_TARGET_ROLES,
  ALLOWED_INTERVIEW_TYPES,
  ALLOWED_DIFFICULTIES,
  ALLOWED_INTERVIEW_MODES,
  ALLOWED_QUESTION_COUNTS,
  ALLOWED_DURATIONS_MINUTES,
  ALLOWED_STATUSES,
  ALLOWED_TRANSITIONS
};
