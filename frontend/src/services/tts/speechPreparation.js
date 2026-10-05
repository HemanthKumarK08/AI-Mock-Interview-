/**
 * Speech Preparation Utility
 * Cleans AI responses, strips internal evaluation/score data, removes markdown,
 * and formats text for natural conversational speech synthesis.
 */

class SpeechPreparation {
  /**
   * Main text cleaning pipeline before speech synthesis
   */
  static prepareTextForSpeech(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText.trim();

    // 1. Remove JSON blocks or curly brace structures
    text = text.replace(/\{[\s\S]*?\}/g, '');

    // 2. Remove Internal Evaluation & scoring metadata (Critical rule: candidate should NEVER hear scores)
    text = text.replace(/\[\s*Internal\s*evaluation[\s\S]*?\]/gi, '');
    text = text.replace(/Score:\s*\d+(\.\d+)?(\s*\/\s*\d+)?/gi, '');
    text = text.replace(/Technical\s*Accuracy:\s*\d+(\.\d+)?/gi, '');
    text = text.replace(/Relevance:\s*\d+(\.\d+)?/gi, '');
    text = text.replace(/Evaluation\s*Confidence:\s*\d+(\.\d+)?/gi, '');
    text = text.replace(/Turn\s*#\d+\s*Feedback/gi, '');
    text = text.replace(/curiosityScore\s*:\s*\d+(\.\d+)?/gi, '');
    text = text.replace(/conversationalGoal\s*:\s*\w+/gi, '');
    text = text.replace(/preferredStrategy\s*:\s*\w+/gi, '');
    text = text.replace(/\[Strategy:[^\]]*\]/gi, '');
    text = text.replace(/\[Intent:[^\]]*\]/gi, '');

    // 3. Remove Markdown headings, bold, italics, code blocks
    text = text.replace(/^#+\s+/gm, ''); // # Heading
    text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // **bold**
    text = text.replace(/\*(.*?)\*/g, '$1'); // *italic*
    text = text.replace(/__(.*?)__/g, '$1'); // __bold__
    text = text.replace(/_(.*?)_/g, '$1'); // _italic_
    text = text.replace(/```[\s\S]*?```/g, 'as shown in the code example'); // Code blocks
    text = text.replace(/`([^`]+)`/g, '$1'); // Inline code `var`
    text = text.replace(/~~(.*?)~~/g, '$1'); // Strikethrough

    // 4. Remove bullet points and numbered list markers to read like continuous speech
    text = text.replace(/^\s*[-*+]\s+/gm, '');
    text = text.replace(/^\s*\d+\.\s+/gm, '');

    // 5. Remove URL links and markdown link syntax [text](url) -> text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 6. Clean conversational artifacts / technical labels
    text = text.replace(/^\s*Question\s*:\s*/gi, '');
    text = text.replace(/^\s*Interviewer\s*:\s*/gi, '');
    text = text.replace(/^\s*AI\s*:\s*/gi, '');
    text = text.replace(/---/g, '');

    // 7. Expand common technical abbreviations for natural pronunciation
    text = text.replace(/\bAPI\b/g, 'A P I');
    text = text.replace(/\bAPIs\b/g, 'A P Is');
    text = text.replace(/\bRESTful\b/g, 'Rest-ful');
    text = text.replace(/\bJWT\b/g, 'J W T');
    text = text.replace(/\bSQL\b/g, 'S Q L');
    text = text.replace(/\bNoSQL\b/g, 'No-S Q L');
    text = text.replace(/\bCI\/CD\b/g, 'C I C D');
    text = text.replace(/\bCRUD\b/g, 'Crud');

    // 8. Normalize multiple spaces and extra newlines into single spaces
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Segment text into natural speech phrases if needed, without robotic gaps
   */
  static segmentForSpeech(text) {
    const clean = this.prepareTextForSpeech(text);
    if (!clean) return [];

    // Split by major sentence endings (. ! ?) while keeping the delimiter
    const sentenceMatches = clean.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
    if (!sentenceMatches || sentenceMatches.length <= 1) {
      return [clean];
    }

    return sentenceMatches.map((s) => s.trim()).filter((s) => s.length > 0);
  }
}

export default SpeechPreparation;
