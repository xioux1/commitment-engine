'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateQuestions, evaluateAnswer, generateSessionSummary } = require('../services/oralReviewer');

const router = Router();

// In-memory session store (no DB dependency — these are ephemeral review sessions)
const sessions = new Map();

// ── POST /api/oral-review/sessions ───────────────────────────────────────────
// Start a new VR oral review session and generate questions
router.post('/sessions', async (req, res, next) => {
  try {
    const { topic, question_count = 3 } = req.body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'topic is required' });
    }
    if (question_count < 1 || question_count > 5) {
      return res.status(400).json({ error: 'question_count must be between 1 and 5' });
    }

    const questions = await generateQuestions(topic.trim(), question_count);

    const session = {
      id: uuidv4(),
      topic: topic.trim(),
      status: 'active',
      created_at: new Date().toISOString(),
      questions,
      answers: [],
      current_question: 0,
    };

    sessions.set(session.id, session);

    res.status(201).json({ data: { session_id: session.id, topic: session.topic, questions } });
  } catch (err) { next(err); }
});

// ── POST /api/oral-review/sessions/:id/answer ─────────────────────────────
// Submit an answer to the current question and receive AI evaluation
router.post('/sessions/:id/answer', async (req, res, next) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active' });

    const { answer, question_id } = req.body;
    if (!answer || typeof answer !== 'string' || !answer.trim()) {
      return res.status(400).json({ error: 'answer is required' });
    }

    const question = session.questions.find((q) => q.id === question_id);
    if (!question) return res.status(400).json({ error: 'Invalid question_id' });

    const evaluation = await evaluateAnswer(question.text, answer.trim(), session.topic);

    session.answers.push({
      question_id,
      question: question.text,
      answer: answer.trim(),
      evaluation,
      answered_at: new Date().toISOString(),
    });

    session.current_question = session.answers.length;

    const is_complete = session.answers.length >= session.questions.length;
    if (is_complete) session.status = 'completed';

    res.json({
      data: {
        evaluation,
        is_complete,
        questions_remaining: session.questions.length - session.answers.length,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/oral-review/sessions/:id/complete ───────────────────────────
// Finalize the session and return the full summary with oral_evaluations score
router.post('/sessions/:id/complete', async (req, res, next) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.answers.length) return res.status(400).json({ error: 'No answers submitted' });

    session.status = 'completed';

    const avg_score = Math.round(
      session.answers.reduce((sum, a) => sum + a.evaluation.score, 0) / session.answers.length,
    );

    const summary = await generateSessionSummary(session.topic, session.answers);

    // oral_evaluations = 1 if avg_score >= 60, 0 otherwise (binary pass/fail for metric tracking)
    const oral_evaluation_passed = avg_score >= 60 ? 1 : 0;

    const result = {
      session_id: session.id,
      topic: session.topic,
      avg_score,
      oral_evaluation_passed,
      questions_answered: session.answers.length,
      answers: session.answers,
      summary,
      completed_at: new Date().toISOString(),
    };

    sessions.delete(session.id);

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── GET /api/oral-review/sessions/:id ────────────────────────────────────
router.get('/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ data: { ...session, answers_count: session.answers.length } });
});

module.exports = router;
