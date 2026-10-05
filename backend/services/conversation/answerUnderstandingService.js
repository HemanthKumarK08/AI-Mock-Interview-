// Answer Understanding Service for MockInterviewAI (Phase 8 & 9)
// Extracts structured entities, technologies, claims, decisions, challenges, results, answer intent, and candidate-owned topics

const TECH_KEYWORDS = [
  'react', 'react native', 'vue', 'angular', 'svelte', 'next.js', 'nextjs', 'nuxt', 'redux', 'mobx', 'zustand', 'tailwind', 'bootstrap',
  'node', 'node.js', 'nodejs', 'express', 'express.js', 'nest', 'nestjs', 'fastapi', 'flask', 'django', 'spring', 'spring boot', 'springboot',
  'java', 'python', 'javascript', 'typescript', 'c++', 'c#', 'golang', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql',
  'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'sqlite', 'oracle',
  'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'lambda', 's3', 'ec2', 'kafka', 'rabbitmq', 'graphql', 'rest', 'restful',
  'jwt', 'oauth', 'websockets', 'socket.io', 'grpc', 'gemini', 'openai', 'llm', 'vad', 'stt', 'tts', 'webrtc', 'ci/cd', 'git', 'github',
  'web audio api', 'web audio'
];

class AnswerUnderstandingService {
  /**
   * Analyzes candidate's answer text in the context of the question asked
   */
  static analyzeAnswer(params, questionArg, questionTopicArg) {
    let studentAnswer, question, questionTopic, turnNumber, conversationHistory;
    if (typeof params === 'string') {
      studentAnswer = params;
      question = questionArg || '';
      questionTopic = questionTopicArg || 'General';
      turnNumber = 1;
      conversationHistory = [];
    } else if (params && typeof params === 'object') {
      ({ studentAnswer, question, questionTopic, turnNumber, conversationHistory = [] } = params);
    } else {
      return this.getEmptyInsight();
    }

    if (!studentAnswer || typeof studentAnswer !== 'string') {
      return this.getEmptyInsight();
    }

    const text = studentAnswer.trim();
    const lowerText = text.toLowerCase();

    // 1. Detect Uncertainty / Non-Implementation / Pivot Requests / Knowledge Gaps
    const uncertaintyMarkers = [];
    const uncertaintyPatterns = [
      /(?:i don'?t know\b(?: the answer)?(?: for this| about that)?|dont know)/i,
      /(?:i have no idea|no idea)/i,
      /(?:i'?m not sure|not sure|not completely sure|not certain)/i,
      /(?:i don'?t remember|don'?t recall|forgot exactly|forgotten|someone else handled)/i,
      /(?:i'?m not familiar|not familiar with|not very familiar)/i,
      /(?:i haven'?t worked with|have not worked with|never worked with|never used|haven'?t used)/i,
      /(?:i don'?t have experience|no experience with|haven'?t had the chance to use)/i,
      /(?:i'?m not confident|not confident about)/i,
      /(?:haven'?t done that|never implemented|didn'?t implement|did not implement|never built|didn'?t build|didn'?t do|haven'?t done anything|didn'?t work on)/i,
      /(?:ask\s+(?:me\s+)?(?:other|another|something else|different)|only ask\s+(?:me\s+)?other)/i,
      /(?:can (?:we|you)\s+(?:skip|change topic|move on|ask something else|switch|ask other))/i,
      /(?:skip\s*(?:this|question)?|no answer|nothing to say|cannot answer)/i,
      /(?:i think|i believe|maybe|perhaps|i guess|probably)/i
    ];

    uncertaintyPatterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        uncertaintyMarkers.push(match[0].trim());
      }
    });

    const isPivotOrNonImplementation = /(?:didn'?t|did not|never|haven'?t|have not)\s+(?:implement|build|develop|create|do|touch|write|work on)|(?:ask\s+(?:me\s+)?(?:other|another|something else|different)|only ask\s+(?:me\s+)?other)|(?:skip\s*(?:this|question)?)|(?:can (?:we|you)\s+(?:skip|change topic|move on|ask something else|switch|ask other))/i.test(lowerText);
    const isDirectUncertainty = isPivotOrNonImplementation || /(?:i don'?t know|dont know|no idea|not sure|not familiar|haven'?t worked|never worked|never used|don'?t remember|no experience|not confident|haven'?t done)/i.test(lowerText);
    const isUncertain = isDirectUncertainty;

    // 2. Extract Technologies & Entities
    const matchedTech = [];
    TECH_KEYWORDS.forEach(tech => {
      const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:\\b|\\s|^)${escaped}(?:\\b|\\s|\\.|,|$|!)`, 'i');
      if (regex.test(text)) {
        matchedTech.push(this.formatTechName(tech));
      }
    });

    const uniqueTech = Array.from(new Set(matchedTech));

    // 3. Extract Projects
    const projects = [];
    const projectPatterns = [
      /(?:built|developed|created|worked on|designed|implemented)\s+(?:an?|the)\s+([a-zA-Z0-9\s\-]+?)(?:using|with|for|in|\.|\,|$)/gi,
      /(?:my|our)\s+project\s+(?:was|is|called)\s+([a-zA-Z0-9\s\-]+?)(?:using|with|for|\.|\,|$)/gi,
      /(?:system|platform|application|app|service|tool|website)\s+(?:called|named|for)\s+([a-zA-Z0-9\s\-]+?)(?:using|with|\.|\,|$)/gi
    ];

    projectPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const rawProj = match[1]?.trim();
        if (rawProj && rawProj.length > 3 && rawProj.length < 50 && !projects.includes(rawProj)) {
          projects.push(rawProj);
        }
      }
    });

    // 4. Extract Decisions (Architectural / Technical choices)
    const decisions = [];
    const decisionPatterns = [
      /(?:chose|chosen|selected|decided to use|opted for|used)\s+([a-zA-Z0-9\s\.\-]+?)\s+(?:because|due to|since|for|to achieve|in order to)\s+([a-zA-Z0-9\s\.\-]+?)(?:\.|\,|$)/gi,
      /(?:prefer|preferred)\s+([a-zA-Z0-9\s\.\-]+?)\s+(?:over|instead of)\s+([a-zA-Z0-9\s\.\-]+?)(?:\.|\,|$)/gi
    ];

    decisionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        decisions.push({
          choice: match[1]?.trim(),
          reason: match[2]?.trim() || 'Not fully stated',
          rawText: match[0]?.trim()
        });
      }
    });

    // 5. Extract Challenges & Problems
    const challenges = [];
    const challengePatterns = [
      /(?:faced|had|encountered)\s+(?:a|an|the|some)?\s*([^.,;!?]+?\b(?:issue|problem|challenge|bottleneck|timeout|error|failure|bug)[^.,;!?]*)/gi,
      /(?:problem|issue|challenge|bottleneck|difficulty|timeout|error|failure|bug)\s+(?:was|with|in|encountered|we had)\s+([^.,;!?]+)/gi,
      /(?:was difficult|was challenging|failed because|hardest part was|toughest part was)\s+([^.,;!?]+)/gi
    ];

    challengePatterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        let item = match[1]?.trim();
        if (item) {
          item = item.split(/\s+(?:when|where|because|after|during)\s+/i)[0].trim();
          if (item.length > 3 && item.length < 80 && !challenges.includes(item)) {
            challenges.push(item);
          }
        }
      }
    });

    // Specific domain challenges
    if (/(?:voice|vad|silence detection|speech recognition)/i.test(text) && /(?:hard|difficult|challenge|issue|problem|stopped|pausing)/i.test(text)) {
      if (!challenges.some(c => /voice|silence|vad/i.test(c))) {
        challenges.push('Voice Activity Detection & Silence Thresholds');
      }
    }
    if (/(?:timeout|gemini|api timeout|rate limit)/i.test(text)) {
      if (!challenges.some(c => /timeout|api/i.test(c))) {
        challenges.push('API Timeouts & Resilience');
      }
    }

    // 6. Extract Results / Achievements / Metrics
    const results = [];
    const resultPatterns = [
      /(?:improved|increased|reduced|decreased|optimized|scaled|achieved|boosted)\s+([a-zA-Z0-9\s\.\-%]+?)(?:by|to|using|\.|\,|$)/gi,
      /(?:result was|outcome was|eventually)\s+([a-zA-Z0-9\s\.\-]+?)(?:\.|\,|$)/gi,
      /(\d+%\s+(?:increase|decrease|improvement|reduction|boost))/gi
    ];

    resultPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const item = (match[1] || match[0])?.trim();
        if (item && item.length > 3 && item.length < 80) {
          results.push(item);
        }
      }
    });

    // 7. Extract Claims & Ownership
    const claims = [];
    let ownership = 'unclear';
    const individualCount = (text.match(/\b(?:I|my|myself|I've|I'd)\b/gi) || []).length;
    const teamCount = (text.match(/\b(?:we|our|us|team|company)\b/gi) || []).length;
    if (individualCount > teamCount && individualCount > 0) {
      ownership = 'individual';
    } else if (teamCount > individualCount && teamCount > 0) {
      ownership = 'team';
    }

    const claimPatterns = [
      /(?:I (?:handled|built|managed|led|designed|implemented|optimized|configured|architected)\s+[a-zA-Z0-9\s\.\-]+?)(?:\.|\,|$)/gi,
      /(?:We (?:deployed|scaled|migrated|refactored|secured)\s+[a-zA-Z0-9\s\.\-]+?)(?:\.|\,|$)/gi
    ];
    claimPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        claims.push(match[0].trim());
      }
    });

    // 8. Vague patterns (hand-waving without substance)
    const unclearPoints = [];
    const vaguePatterns = [
      /(?:used AI to make it|made it better with AI|used AI to improve|AI to make it|better and faster|faster and better)/i,
      /(?:improved performance a lot|made it much faster)/i,
      /(?:did some optimizations|did some backend work)/i,
      /(?:standard things|usual setup|normal way|connects? (?:stuff|things) together)/i,
      /(?:etc|and stuff|and so on)/i
    ];

    vaguePatterns.forEach(pattern => {
      if (pattern.test(text)) {
        unclearPoints.push(text.match(pattern)[0]);
      }
    });

    const isVague = unclearPoints.length > 0 || uncertaintyMarkers.length > 0 || (text.length < 50 && !isUncertain && uniqueTech.length === 0 && decisions.length === 0 && challenges.length === 0);

    // 9. Primary Intent Classification
    let intent = 'DIRECT_ANSWER';
    if (isUncertain) {
      intent = 'UNCERTAIN';
    } else if (challenges.length > 0) {
      intent = 'CHALLENGE';
    } else if (decisions.length > 0) {
      intent = 'DECISION';
    } else if (results.length > 0) {
      intent = 'RESULT';
    } else if (isVague) {
      intent = 'VAGUE';
    } else if (claims.length > 0 && ownership === 'team') {
      intent = 'CLAIM';
    } else if (uniqueTech.length > 0 && text.length > 40) {
      intent = 'TECHNICAL_DETAIL';
    } else if (text.length > 100) {
      intent = 'KNOWLEDGEABLE';
    }

    // 10. Candidate-Owned Topic Identification
    let candidateOwnedTopic = null;
    if (challenges.length > 0) {
      candidateOwnedTopic = challenges[0];
    } else if (decisions.length > 0) {
      candidateOwnedTopic = decisions[0].choice;
    } else if (uniqueTech.length > 0) {
      candidateOwnedTopic = uniqueTech[0];
    } else if (projects.length > 0) {
      candidateOwnedTopic = projects[0];
    }

    // 11. Follow-up candidate opportunities
    const followUpCandidates = [];
    challenges.forEach(ch => {
      followUpCandidates.push({
        type: 'CHALLENGE',
        topic: ch,
        promptHook: `You mentioned encountering an issue with ${ch}. How did you troubleshoot and resolve that?`
      });
    });

    decisions.forEach(dec => {
      followUpCandidates.push({
        type: 'DECISION',
        topic: dec.choice,
        promptHook: `Why did you decide to use ${dec.choice} instead of other alternatives?`
      });
    });

    uniqueTech.forEach(t => {
      followUpCandidates.push({
        type: 'DEEP_DIVE',
        topic: t,
        promptHook: `You mentioned using ${t}. Could you explain how you structured that in your application?`
      });
    });

    // 12. Sentiments
    const prideMarkers = /(?:proud of|biggest achievement|major success|accomplished|breakthrough|loved working on)/i.test(text);
    const difficultyMarkers = /(?:hardest part|most difficult|toughest challenge|struggled with|complex obstacle)/i.test(text);

    let summary = text.slice(0, 150);
    if (text.length > 150) summary += '...';

    return {
      summary,
      intent,
      isUncertain,
      uncertaintyMarkers,
      candidateOwnedTopic,
      entities: uniqueTech,
      technologies: uniqueTech,
      projects,
      claims,
      ownership,
      prideMarkers,
      difficultyMarkers,
      decisions,
      challenges,
      results,
      unclearPoints,
      interestingDetails: [...challenges, ...decisions.map(d => d.choice)],
      followUpCandidates,
      isVague,
      answerLength: text.length
    };
  }

  static formatTechName(tech) {
    const map = {
      'react': 'React',
      'react native': 'React Native',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'svelte': 'Svelte',
      'next.js': 'Next.js',
      'nextjs': 'Next.js',
      'node': 'Node.js',
      'node.js': 'Node.js',
      'nodejs': 'Node.js',
      'express': 'Express.js',
      'express.js': 'Express.js',
      'fastapi': 'FastAPI',
      'flask': 'Flask',
      'django': 'Django',
      'spring': 'Spring',
      'spring boot': 'Spring Boot',
      'springboot': 'Spring Boot',
      'java': 'Java',
      'python': 'Python',
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'c++': 'C++',
      'c#': 'C#',
      'golang': 'Go',
      'go': 'Go',
      'rust': 'Rust',
      'sql': 'SQL',
      'mysql': 'MySQL',
      'postgresql': 'PostgreSQL',
      'postgres': 'PostgreSQL',
      'mongodb': 'MongoDB',
      'mongo': 'MongoDB',
      'redis': 'Redis',
      'docker': 'Docker',
      'kubernetes': 'Kubernetes',
      'k8s': 'Kubernetes',
      'aws': 'AWS',
      'graphql': 'GraphQL',
      'rest': 'REST API',
      'restful': 'RESTful API',
      'jwt': 'JWT',
      'gemini': 'Gemini API',
      'openai': 'OpenAI',
      'vad': 'Voice Activity Detection (VAD)',
      'stt': 'Speech-to-Text',
      'tts': 'Text-to-Speech',
      'web audio api': 'Web Audio API',
      'web audio': 'Web Audio API'
    };
    return map[tech.toLowerCase()] || tech.charAt(0).toUpperCase() + tech.slice(1);
  }

  static getEmptyInsight() {
    return {
      summary: '',
      intent: 'DIRECT_ANSWER',
      isUncertain: false,
      candidateOwnedTopic: null,
      entities: [],
      technologies: [],
      projects: [],
      claims: [],
      ownership: 'unclear',
      uncertaintyMarkers: [],
      prideMarkers: false,
      difficultyMarkers: false,
      decisions: [],
      challenges: [],
      results: [],
      unclearPoints: [],
      interestingDetails: [],
      followUpCandidates: [],
      isVague: false,
      answerLength: 0
    };
  }
}

module.exports = AnswerUnderstandingService;
