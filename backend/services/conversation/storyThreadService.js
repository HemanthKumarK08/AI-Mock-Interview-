// Story Thread Service for MockInterviewAI (Phase 9)
// Tracks narrative story arcs, unresolved details, candidate-owned threads, and thread lifecycle across interview turns

class StoryThreadService {
  /**
   * Creates a new story thread object
   */
  static createThread({
    title,
    topic,
    initialClaim = null,
    candidateClaims = [],
    technology = null,
    project = null,
    challenge = null,
    challenges = [],
    decision = null,
    decisions = [],
    turnNumber = 1,
    isCandidateOwned = true
  }) {
    const threadId = `thread_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const claimsList = Array.isArray(candidateClaims) && candidateClaims.length > 0 
      ? [...candidateClaims] 
      : (initialClaim ? [initialClaim] : []);
    const decisionsList = Array.isArray(decisions) && decisions.length > 0
      ? [...decisions]
      : (decision ? [decision] : []);
    const challengesList = Array.isArray(challenges) && challenges.length > 0
      ? [...challenges]
      : (challenge ? [challenge] : []);

    const unresolved = [];
    challengesList.forEach(ch => {
      unresolved.push(`How candidate diagnosed and resolved ${ch}`);
    });
    decisionsList.forEach(dec => {
      unresolved.push(`Why ${dec} was selected over alternatives`);
    });
    if (technology) {
      unresolved.push(`How ${technology} was structured in candidate's implementation`);
    }

    return {
      id: threadId,
      title: title || (technology ? `${technology} Implementation` : (project || (challengesList[0] ? `${challengesList[0]} Troubleshooting` : 'Project Narrative'))),
      topic: topic || technology || 'General',
      status: 'introduced', // 'introduced' | 'developing' | 'deep' | 'resolved' | 'pivoted' | 'abandoned'
      depth: 1,
      candidateClaims: claimsList,
      decisions: decisionsList,
      challenges: challengesList,
      actions: [],
      outcomes: [],
      unresolvedQuestions: unresolved,
      interestingDetails: [...challengesList, ...decisionsList],
      isCandidateOwned,
      lastReferencedTurn: turnNumber,
      confidence: 0.85
    };
  }

  /**
   * Ingests turn data and updates existing threads or introduces a new thread
   */
  static updateThreads(existingThreads = [], arg2 = {}, arg3 = 'General', arg4 = 1) {
    const threads = Array.isArray(existingThreads) ? [...existingThreads] : [];
    
    let insight = {};
    let turnTopic = 'General';
    let turnNumber = 1;

    if (arg2 && (arg2.turn || arg2.insight)) {
      insight = arg2.insight || {};
      turnTopic = arg2.turn?.question_topic || arg2.questionMetadata?.topic || 'General';
      turnNumber = arg2.turn?.turn_number || 1;
    } else {
      insight = arg2 || {};
      turnTopic = typeof arg3 === 'string' ? arg3 : 'General';
      turnNumber = typeof arg4 === 'number' ? arg4 : 1;
    }

    // 1. If candidate is UNCERTAIN ("I don't know"), pivot out of the active thread
    if (insight.isUncertain || insight.intent === 'UNCERTAIN') {
      threads.forEach(t => {
        if (t.status === 'developing' || t.status === 'introduced' || t.status === 'deep') {
          t.status = 'pivoted';
          t.resolutionReason = 'Candidate expressed uncertainty; pivoted to supportive topic';
        }
      });
      return threads;
    }

    // 2. Check for abandoned threads (turns elapsed > 3 without reference)
    threads.forEach(t => {
      if (t.status !== 'resolved' && t.status !== 'abandoned' && t.status !== 'pivoted') {
        if (turnNumber - t.lastReferencedTurn >= 4) {
          t.status = 'abandoned';
        }
      }
    });

    // 3. Find if an active/developing thread matches the current turn or topic
    let activeThread = threads.find(t => 
      (t.status === 'developing' || t.status === 'introduced' || t.status === 'deep') &&
      (t.topic.toLowerCase() === turnTopic.toLowerCase() || (insight.technologies || []).some(tech => tech.toLowerCase().includes(t.topic.toLowerCase())))
    );

    if (!activeThread) {
      activeThread = threads.find(t => t.status === 'developing' || t.status === 'introduced');
    }

    const newChallenge = insight.challenges?.[0];
    const newDecision = typeof insight.decisions?.[0] === 'string' ? insight.decisions[0] : insight.decisions?.[0]?.choice;
    const newTech = insight.technologies?.[0];
    const newProject = insight.projects?.[0];

    if (!activeThread) {
      if (newChallenge && !threads.some(t => t.challenges.includes(newChallenge) && t.status !== 'abandoned')) {
        const challengeThread = this.createThread({
          title: `${newChallenge} Troubleshooting`,
          topic: turnTopic !== 'General' ? turnTopic : newChallenge,
          challenge: newChallenge,
          challenges: [newChallenge],
          turnNumber,
          isCandidateOwned: true
        });
        challengeThread.status = 'developing';
        threads.unshift(challengeThread);
      } else if (newTech || newProject || newDecision || insight.claims?.length > 0) {
        const freshThread = this.createThread({
          title: newProject || (newTech ? `${newTech} Architecture` : 'Project Experience'),
          topic: turnTopic !== 'General' ? turnTopic : (newTech || 'General'),
          initialClaim: insight.claims?.[0] || null,
          candidateClaims: insight.claims || [],
          technology: newTech,
          project: newProject,
          challenges: insight.challenges || [],
          decisions: insight.decisions ? (insight.decisions.map(d => typeof d === 'string' ? d : d.choice)) : [],
          turnNumber
        });
        threads.push(freshThread);
      }
    } else {
      activeThread.depth += 1;
      activeThread.lastReferencedTurn = turnNumber;

      if (insight.claims && insight.claims.length > 0) {
        activeThread.candidateClaims.push(...insight.claims);
      }
      if (insight.decisions && insight.decisions.length > 0) {
        const decNames = insight.decisions.map(d => typeof d === 'string' ? d : d.choice);
        activeThread.decisions.push(...decNames);
      }
      if (insight.challenges && insight.challenges.length > 0) {
        activeThread.challenges.push(...insight.challenges);
      }
      if (insight.results && insight.results.length > 0) {
        activeThread.outcomes.push(...insight.results);
      }

      if (activeThread.depth >= 3 || (activeThread.challenges.length > 0 && activeThread.decisions.length > 0 && activeThread.depth >= 3)) {
        activeThread.status = 'deep';
      } else if (activeThread.depth >= 2) {
        activeThread.status = 'developing';
      }

      if (activeThread.depth >= 5) {
        activeThread.status = 'resolved';
      }
    }

    return threads;
  }

  /**
   * Gets the most compelling active or unresolved thread for questioning
   */
  static getPrimaryDevelopingThread(threads = []) {
    if (!Array.isArray(threads) || threads.length === 0) return null;

    // Prefer newly introduced or developing candidate-owned threads
    const candidateOwned = threads.find(t => t.isCandidateOwned && (t.status === 'developing' || t.status === 'introduced'));
    if (candidateOwned) return candidateOwned;

    const developing = threads.find(t => t.status === 'developing');
    if (developing) return developing;

    const introduced = threads.find(t => t.status === 'introduced');
    if (introduced) return introduced;

    const deep = threads.find(t => t.status === 'deep');
    if (deep) return deep;

    return null;
  }

  /**
   * Marks a thread as resolved
   */
  static resolveThread(threadsOrThread, reasonOrId) {
    if (!threadsOrThread) return threadsOrThread;

    if (typeof threadsOrThread === 'object' && !Array.isArray(threadsOrThread)) {
      threadsOrThread.status = 'resolved';
      threadsOrThread.resolutionReason = reasonOrId || 'Sufficiently explored';
      return threadsOrThread;
    }

    const threadId = reasonOrId;
    return threadsOrThread.map(t => {
      if (t.id === threadId) {
        return { ...t, status: 'resolved' };
      }
      return t;
    });
  }
}

module.exports = StoryThreadService;
