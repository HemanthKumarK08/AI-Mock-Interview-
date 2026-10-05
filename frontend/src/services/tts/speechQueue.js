/**
 * Speech Queue Manager
 * Ensures sequential playback of speech utterances without audio overlap.
 */

class SpeechQueue {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTask = null;
  }

  /**
   * Enqueue a speech task
   * @param {Object} task - { text, options, speakFn, onEnd, onError }
   */
  enqueue(task) {
    this.queue.push(task);
    if (!this.isPlaying && !this.isPaused) {
      this.playNext();
    }
  }

  /**
   * Play the next task in the queue
   */
  async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentTask = null;
      return;
    }

    if (this.isPaused) {
      return;
    }

    this.isPlaying = true;
    const task = this.queue.shift();
    this.currentTask = task;

    try {
      if (typeof task.speakFn === 'function') {
        await new Promise((resolve) => {
          let resolved = false;

          const finish = () => {
            if (resolved) return;
            resolved = true;
            if (task.onEnd) task.onEnd();
            resolve();
          };

          const error = (err) => {
            if (resolved) return;
            resolved = true;
            if (task.onError) task.onError(err);
            resolve();
          };

          task.speakFn(task.text, task.options, finish, error);
        });
      }
    } catch (err) {
      console.warn('[SpeechQueue] Error during task playback:', err);
      if (task.onError) task.onError(err);
    } finally {
      this.currentTask = null;
      // Continue next item in queue
      this.playNext();
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      if (!this.isPlaying) {
        this.playNext();
      }
    }
  }

  stop() {
    this.clear();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTask = null;
  }

  clear() {
    this.queue = [];
  }

  size() {
    return this.queue.length + (this.isPlaying ? 1 : 0);
  }
}

export default SpeechQueue;
