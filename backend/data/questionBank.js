// Curated Fallback Question Bank for MockInterviewAI
// Used as guaranteed high-quality fallback when AI is unavailable, times out, or fails validation

const QUESTION_BANK = {
  'Java Developer': {
    technical: {
      beginner: [
        { question: 'Can you explain the main principles of Object-Oriented Programming (OOP) and how Java implements them?', topic: 'OOP Fundamentals', type: 'technical' },
        { question: 'What is the difference between String, StringBuilder, and StringBuffer in Java?', topic: 'Core Java', type: 'technical' },
        { question: 'Explain the difference between checked and unchecked exceptions in Java with examples.', topic: 'Exception Handling', type: 'technical' },
        { question: 'What is the Java Virtual Machine (JVM), and how does the Garbage Collection process work at a high level?', topic: 'JVM Architecture', type: 'technical' },
        { question: 'What is the difference between an ArrayList and a LinkedList in Java collections?', topic: 'Data Structures', type: 'technical' }
      ],
      intermediate: [
        { question: 'Explain the difference between HashMap and ConcurrentHashMap. How does ConcurrentHashMap achieve thread safety without locking the entire map?', topic: 'Concurrency & Collections', type: 'technical' },
        { question: 'How do Java Streams work internally, and what are the key differences between intermediate and terminal operations?', topic: 'Java 8+ Streams', type: 'technical' },
        { question: 'What are the SOLID design principles, and how have you applied Dependency Inversion in your Java projects?', topic: 'Design Principles', type: 'technical' },
        { question: 'Explain Spring Boot dependency injection and the lifecycle of a Spring Bean.', topic: 'Spring Framework', type: 'technical' },
        { question: 'How does database connection pooling (like HikariCP) work in a high-throughput Java application?', topic: 'Database & Performance', type: 'technical' }
      ],
      advanced: [
        { question: 'How does the Java Memory Model (JMM) define memory visibility, and what are the exact semantics of the volatile keyword and happens-before relationships?', topic: 'Concurrency & Memory Model', type: 'technical' },
        { question: 'How would you architect a distributed transactional workflow across multiple Spring Boot microservices using the Saga pattern?', topic: 'Distributed Systems', type: 'technical' },
        { question: 'Explain the internal mechanics of Java 21 Virtual Threads (Project Loom) compared to platform threads, and when they should not be used.', topic: 'JVM Concurrency', type: 'technical' },
        { question: 'How would you diagnose and resolve a severe Garbage Collection pause issue in a low-latency Java application under heavy heap pressure?', topic: 'JVM Tuning', type: 'technical' }
      ]
    },
    behavioral: {
      beginner: [
        { question: 'Tell me about a challenging coding bug you encountered in a Java project and how you went about diagnosing and fixing it.', topic: 'Problem Solving', type: 'behavioral' },
        { question: 'Describe a situation where you had to learn a new framework or library quickly to complete an assignment.', topic: 'Adaptability', type: 'behavioral' }
      ],
      intermediate: [
        { question: 'Can you describe a time when you disagreed with a teammate on an architectural or code design decision? How did you reach a consensus?', topic: 'Collaboration & Conflict', type: 'behavioral' },
        { question: 'Tell me about a project where you had to refactor a legacy or poorly performing codebase under tight deadline constraints.', topic: 'Execution & Quality', type: 'behavioral' }
      ],
      advanced: [
        { question: 'Describe a situation where a major production incident occurred in a service you owned. How did you manage the crisis and prevent recurrence?', topic: 'Incident Management', type: 'behavioral' }
      ]
    },
    hr: {
      beginner: [
        { question: 'Why are you specifically interested in pursuing a career as a Java Developer, and what are your immediate learning goals?', topic: 'Motivation', type: 'hr' },
        { question: 'How do you prioritize your tasks when juggling multiple deadlines or academic deliverables?', topic: 'Time Management', type: 'hr' }
      ],
      intermediate: [
        { question: 'What type of engineering culture and team dynamic brings out your best performance as a backend developer?', topic: 'Culture Fit', type: 'hr' }
      ],
      advanced: [
        { question: 'Where do you see yourself contributing most to engineering leadership and team mentorship over the next 2-3 years?', topic: 'Career Vision', type: 'hr' }
      ]
    }
  },

  'Python Developer': {
    technical: {
      beginner: [
        { question: 'What are the key differences between Python lists, tuples, sets, and dictionaries, and what are their time complexities?', topic: 'Data Structures', type: 'technical' },
        { question: 'Explain how Python handles memory management and what the Global Interpreter Lock (GIL) is.', topic: 'Python Internals', type: 'technical' },
        { question: 'What are Python decorators and how do they work behind the scenes?', topic: 'Functions & Decorators', type: 'technical' }
      ],
      intermediate: [
        { question: 'How do Python generators and the yield keyword work, and when would you choose a generator over a standard list comprehension?', topic: 'Iterators & Generators', type: 'technical' },
        { question: 'Explain the difference between multiprocessing and multithreading in Python, especially regarding CPU-bound vs I/O-bound workloads.', topic: 'Concurrency', type: 'technical' },
        { question: 'How do async/await and the asyncio event loop work in Python web frameworks like FastAPI?', topic: 'Asynchronous Programming', type: 'technical' }
      ],
      advanced: [
        { question: 'How would you architect an event-driven data processing pipeline using Celery/RabbitMQ with resilient error handling in Python?', topic: 'Distributed Architecture', type: 'technical' }
      ]
    },
    behavioral: {
      intermediate: [
        { question: 'Tell me about a time you optimized a slow Python script or API endpoint. What profiling tools did you use and what was the outcome?', topic: 'Performance Optimization', type: 'behavioral' }
      ]
    },
    hr: {
      intermediate: [
        { question: 'What motivates you to specialize in Python development, and how do you stay updated with changes in the ecosystem?', topic: 'Motivation', type: 'hr' }
      ]
    }
  },

  'Full Stack Developer': {
    technical: {
      beginner: [
        { question: 'Explain how the client-server model works when a user types a URL into a browser and receives a rendered web page.', topic: 'Web Architecture', type: 'technical' },
        { question: 'What is the difference between state and props in React, and how does unidirectional data flow work?', topic: 'React Fundamentals', type: 'technical' },
        { question: 'What are RESTful API best practices regarding HTTP status codes and endpoint naming conventions?', topic: 'API Design', type: 'technical' }
      ],
      intermediate: [
        { question: 'How do you handle authentication and state synchronization across a React frontend and an Express/Node backend using JWTs and secure cookies?', topic: 'Full Stack Auth & Security', type: 'technical' },
        { question: 'Explain database indexing strategies. When would adding an index degrade database performance rather than improve it?', topic: 'Database Optimization', type: 'technical' },
        { question: 'How do React useEffect cleanup functions work, and how do you prevent memory leaks and race conditions in asynchronous API calls?', topic: 'Frontend State & Lifecycle', type: 'technical' }
      ],
      advanced: [
        { question: 'How would you design a scalable full-stack real-time collaboration tool (like Google Docs or Figma) addressing latency and concurrent edits?', topic: 'System Design', type: 'technical' }
      ]
    },
    behavioral: {
      intermediate: [
        { question: 'Describe a project where you had to bridge frontend user experience requirements with backend architectural constraints. How did you balance trade-offs?', topic: 'Cross-functional Balance', type: 'behavioral' }
      ]
    },
    hr: {
      intermediate: [
        { question: 'How do you balance writing high-quality code with meeting fast product shipping deadlines?', topic: 'Work Ethic', type: 'hr' }
      ]
    }
  },

  'Software Engineer': {
    technical: {
      beginner: [
        { question: 'What is Big-O notation, and why is it critical when evaluating algorithm time and space complexity?', topic: 'Algorithms', type: 'technical' },
        { question: 'Explain the difference between a stack and a queue data structure, including real-world use cases for each.', topic: 'Data Structures', type: 'technical' }
      ],
      intermediate: [
        { question: 'Explain the difference between horizontal and vertical scaling, and how load balancers distribute traffic across multiple service instances.', topic: 'System Scalability', type: 'technical' },
        { question: 'How do ACID properties ensure database transaction integrity during high-concurrency operations?', topic: 'Database Systems', type: 'technical' }
      ],
      advanced: [
        { question: 'Design a distributed rate limiter that can handle 100,000 requests per second across multiple regional datacenters.', topic: 'System Design', type: 'technical' }
      ]
    },
    behavioral: {
      intermediate: [
        { question: 'Tell me about a time you identified a critical performance bottleneck in production. How did you isolate and resolve it?', topic: 'Debugging & Reliability', type: 'behavioral' }
      ]
    },
    hr: {
      intermediate: [
        { question: 'Why are you passionate about software engineering, and what engineering problem has fascinated you most recently?', topic: 'Passion & Growth', type: 'hr' }
      ]
    }
  }
};

// Generic fallback pool if a specific combination is not in the custom bank
const GENERIC_FALLBACKS = {
  technical: [
    { question: 'Can you describe the core architectural components of the most complex software system you have built?', topic: 'Architecture', type: 'technical' },
    { question: 'How do you approach debugging an intermittent error that only appears under heavy production load?', topic: 'Troubleshooting', type: 'technical' },
    { question: 'Explain the trade-offs between relational (SQL) and non-relational (NoSQL) databases for high-velocity data.', topic: 'Data Storage', type: 'technical' },
    { question: 'What caching strategies (e.g. Cache-Aside, Write-Through) have you utilized to optimize API response times?', topic: 'Caching', type: 'technical' },
    { question: 'How do you ensure data consistency and idempotency in distributed REST APIs?', topic: 'API Reliability', type: 'technical' }
  ],
  behavioral: [
    { question: 'Tell me about a time you had to pivot your technical approach mid-project due to changing requirements.', topic: 'Agility', type: 'behavioral' },
    { question: 'Describe a situation where you had to explain a complex technical concept to a non-technical stakeholder.', topic: 'Communication', type: 'behavioral' },
    { question: 'Can you give an example of a mistake you made in code or design, and what you learned from the experience?', topic: 'Continuous Improvement', type: 'behavioral' }
  ],
  hr: [
    { question: 'What are the top three criteria you look for in a team and working environment?', topic: 'Workplace Values', type: 'hr' },
    { question: 'How do you continuously learn and incorporate modern engineering practices into your daily work?', topic: 'Professional Development', type: 'hr' },
    { question: 'Where do you see your technical trajectory evolving over the next few years?', topic: 'Career Objectives', type: 'hr' }
  ]
};

function getFallbackQuestion({ role, interviewType, difficulty, turnNumber, previousQuestions = [] }) {
  const normRole = Object.keys(QUESTION_BANK).find(r => r.toLowerCase() === (role || '').toLowerCase()) || 'Software Engineer';
  const roleBank = QUESTION_BANK[normRole] || QUESTION_BANK['Software Engineer'];

  let typeKey = (interviewType || 'technical').toLowerCase();
  if (typeKey === 'mixed') {
    // Alternate between technical and behavioral
    typeKey = turnNumber % 2 === 1 ? 'technical' : 'behavioral';
  }

  const diffKey = (difficulty || 'intermediate').toLowerCase();
  let pool = roleBank[typeKey]?.[diffKey] || roleBank[typeKey]?.['intermediate'] || GENERIC_FALLBACKS[typeKey] || GENERIC_FALLBACKS.technical;

  // Filter out any questions already asked
  const prevTexts = previousQuestions.map(q => (q || '').trim().toLowerCase());
  let available = pool.filter(item => !prevTexts.some(p => p.includes(item.question.toLowerCase().slice(0, 30))));

  if (available.length === 0) {
    // If specific pool exhausted, look into generic fallbacks
    const genericPool = GENERIC_FALLBACKS[typeKey] || GENERIC_FALLBACKS.technical;
    available = genericPool.filter(item => !prevTexts.some(p => p.includes(item.question.toLowerCase().slice(0, 30))));
  }

  const selected = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : {
        question: `In your role as a ${role}, what engineering best practices do you follow to ensure testability, scalability, and code maintainability?`,
        topic: 'Engineering Best Practices',
        type: typeKey
      };

  return {
    question: selected.question,
    questionType: selected.type || 'technical',
    topic: selected.topic || 'Software Development',
    difficulty: diffKey,
    isFollowUp: false,
    shouldContinue: true,
    isFallback: true
  };
}

module.exports = {
  QUESTION_BANK,
  GENERIC_FALLBACKS,
  getFallbackQuestion
};
