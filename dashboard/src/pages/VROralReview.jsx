import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';

// ── States del flujo ──────────────────────────────────────────────────────────
const STAGE = {
  SETUP:      'setup',
  ENTERING:   'entering',
  READY:      'ready',
  LISTENING:  'listening',
  EVALUATING: 'evaluating',
  FEEDBACK:   'feedback',
  RESULTS:    'results',
};

// ── Avatar holográfico ────────────────────────────────────────────────────────
function HologramAvatar({ stage }) {
  const pulseClass = stage === STAGE.LISTENING
    ? 'scale-110 shadow-[0_0_60px_20px_rgba(163,230,53,0.4)]'
    : stage === STAGE.EVALUATING
    ? 'scale-105 shadow-[0_0_40px_15px_rgba(59,130,246,0.4)]'
    : 'shadow-[0_0_30px_10px_rgba(163,230,53,0.15)]';

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Anillos orbitales */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Anillo exterior */}
        <div
          className="absolute w-48 h-48 rounded-full border border-[#a3e635]/20"
          style={{ animation: 'spin 8s linear infinite' }}
        />
        <div
          className="absolute w-36 h-36 rounded-full border border-[#a3e635]/30"
          style={{ animation: 'spin 5s linear infinite reverse' }}
        />
        <div
          className="absolute w-24 h-24 rounded-full border border-[#a3e635]/40"
          style={{ animation: 'spin 3s linear infinite' }}
        />

        {/* Núcleo del avatar */}
        <div
          className={`relative w-20 h-20 rounded-full bg-gradient-to-br from-[#a3e635]/30 to-[#22c55e]/10
            border border-[#a3e635]/50 flex items-center justify-center transition-all duration-500 ${pulseClass}`}
          style={{ animation: 'pulse 2s ease-in-out infinite' }}
        >
          {/* Icono central */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="12" r="6" stroke="#a3e635" strokeWidth="1.5" fill="none"/>
            <path d="M6 30c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#a3e635" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <circle cx="18" cy="12" r="2" fill="#a3e635" opacity="0.7"/>
          </svg>

          {/* Onda cuando escucha */}
          {stage === STAGE.LISTENING && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-[#a3e635]/60 animate-ping" />
              <div className="absolute -inset-2 rounded-full border border-[#a3e635]/30 animate-ping"
                style={{ animationDelay: '0.3s' }} />
            </>
          )}
        </div>
      </div>

      {/* Nombre del examinador */}
      <div className="text-center">
        <p className="font-mono text-[#a3e635] text-sm tracking-widest uppercase">Examiner AI</p>
        <div className="flex items-center gap-2 mt-1 justify-center">
          <div className={`w-1.5 h-1.5 rounded-full ${
            stage === STAGE.LISTENING ? 'bg-[#a3e635] animate-pulse' :
            stage === STAGE.EVALUATING ? 'bg-blue-400 animate-pulse' :
            'bg-[#a3e635]/40'
          }`} />
          <span className="font-mono text-xs text-gray-500">
            {stage === STAGE.LISTENING ? 'ESCUCHANDO' :
             stage === STAGE.EVALUATING ? 'ANALIZANDO' :
             stage === STAGE.FEEDBACK ? 'EVALUADO' :
             'EN LÍNEA'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Ondas de audio visualizadas ───────────────────────────────────────────────
function AudioWaveform({ active }) {
  const bars = 20;
  return (
    <div className="flex items-center gap-0.5 h-8">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-150 ${
            active ? 'bg-[#a3e635]' : 'bg-[#a3e635]/20'
          }`}
          style={{
            height: active
              ? `${8 + Math.sin(Date.now() / 150 + i) * 20 + Math.random() * 16}px`
              : '4px',
            animation: active ? `wave ${0.5 + (i % 5) * 0.1}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 80 ? '#a3e635' : score >= 60 ? '#eab308' : '#ef4444';

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1a1a1a" strokeWidth="6"/>
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
      </svg>
      <span className="font-mono text-xl font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Particle background ───────────────────────────────────────────────────────
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          className="absolute w-px h-px bg-[#a3e635] rounded-full opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite alternate`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}
      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(163,230,53,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(163,230,53,0.5) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function VROralReview() {
  const [stage, setStage] = useState(STAGE.SETUP);
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(3);
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentEval, setCurrentEval] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [sessionResult, setSessionResult] = useState(null);
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');

  const recognitionRef = useRef(null);
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Iniciar sesión VR
  const startSession = async () => {
    if (!topic.trim()) { setError('Escribe un tema para continuar'); return; }
    setError('');
    setStage(STAGE.ENTERING);
    setLoadingMsg('Inicializando entorno VR...');

    try {
      await new Promise(r => setTimeout(r, 1200));
      setLoadingMsg('Generando preguntas con IA...');

      const { data } = await api.post('/oral-review/sessions', {
        topic: topic.trim(),
        question_count: questionCount,
      });

      setSessionId(data.data.session_id);
      setQuestions(data.data.questions);
      setLoadingMsg('Calibrando examinador...');
      await new Promise(r => setTimeout(r, 800));
      setStage(STAGE.READY);
    } catch (e) {
      setError(e.response?.data?.error || 'Error conectando con el servidor');
      setStage(STAGE.SETUP);
    }
  };

  // Web Speech API
  const startListening = useCallback(() => {
    if (!speechSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + ' ';
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setStage(STAGE.LISTENING);
    setTranscript('');
  }, [speechSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Enviar respuesta para evaluación
  const submitAnswer = async () => {
    if (!transcript.trim()) return;
    stopListening();
    setStage(STAGE.EVALUATING);
    setError('');

    try {
      const question = questions[currentIdx];
      const { data } = await api.post(`/oral-review/sessions/${sessionId}/answer`, {
        question_id: question.id,
        answer: transcript.trim(),
      });

      const result = {
        question: question.text,
        answer: transcript.trim(),
        evaluation: data.data.evaluation,
      };
      setCurrentEval(data.data.evaluation);
      setAllResults(prev => [...prev, result]);
      setStage(STAGE.FEEDBACK);
    } catch (e) {
      setError(e.response?.data?.error || 'Error evaluando respuesta');
      setStage(STAGE.LISTENING);
    }
  };

  // Siguiente pregunta o resultados finales
  const nextQuestion = async () => {
    const nextIdx = currentIdx + 1;

    if (nextIdx >= questions.length) {
      // Finalizar sesión
      setStage(STAGE.EVALUATING);
      setLoadingMsg('Generando análisis final...');
      try {
        const { data } = await api.post(`/oral-review/sessions/${sessionId}/complete`);
        setSessionResult(data.data);
        setStage(STAGE.RESULTS);
      } catch (e) {
        setError(e.response?.data?.error || 'Error generando resumen');
        setStage(STAGE.FEEDBACK);
      }
    } else {
      setCurrentIdx(nextIdx);
      setTranscript('');
      setCurrentEval(null);
      setStage(STAGE.READY);
    }
  };

  const restart = () => {
    setStage(STAGE.SETUP);
    setTopic('');
    setSessionId(null);
    setQuestions([]);
    setCurrentIdx(0);
    setTranscript('');
    setIsRecording(false);
    setCurrentEval(null);
    setAllResults([]);
    setSessionResult(null);
    setError('');
  };

  // ── Render: SETUP ───────────────────────────────────────────────────────────
  if (stage === STAGE.SETUP) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#a3e635]/10 border border-[#a3e635]/30 rounded-full px-4 py-1 mb-6">
              <div className="w-2 h-2 rounded-full bg-[#a3e635] animate-pulse" />
              <span className="font-mono text-[#a3e635] text-xs tracking-widest">ORAL REVIEW · VR MODE</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Examen Oral con IA</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Un examinador de IA te hará preguntas sobre tu tema.<br/>
              Habla tus respuestas en voz alta. Tu resultado se registra como métrica de compromiso.
            </p>
          </div>

          <div className="space-y-5 bg-[#111] border border-[#222] rounded-2xl p-6">
            <div>
              <label className="block font-mono text-xs text-gray-400 mb-2 tracking-wide uppercase">
                Tema del examen
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startSession()}
                placeholder="ej. Redes neuronales, Solidity, Mecánica cuántica..."
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white
                  placeholder-gray-600 focus:outline-none focus:border-[#a3e635]/50 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-gray-400 mb-3 tracking-wide uppercase">
                Número de preguntas
              </label>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 py-2 rounded-lg border font-mono text-sm transition-all ${
                      questionCount === n
                        ? 'bg-[#a3e635] text-black border-[#a3e635] font-bold'
                        : 'bg-transparent border-[#333] text-gray-400 hover:border-[#a3e635]/40'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {!speechSupported && (
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-3">
                <p className="font-mono text-yellow-400 text-xs">
                  Tu navegador no soporta reconocimiento de voz. Podrás escribir tus respuestas manualmente.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3">
                <p className="font-mono text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              onClick={startSession}
              disabled={!topic.trim()}
              className="w-full py-3 bg-[#a3e635] text-black font-bold font-mono text-sm rounded-lg
                tracking-wide hover:bg-[#bef264] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ENTRAR AL ENTORNO VR →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: ENTERING ────────────────────────────────────────────────────────
  if (stage === STAGE.ENTERING) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <ParticleField />
        <div className="text-center relative z-10">
          <HologramAvatar stage={STAGE.ENTERING} />
          <p className="font-mono text-[#a3e635] text-sm mt-8 tracking-wider animate-pulse">
            {loadingMsg}
          </p>
          <div className="flex gap-1 justify-center mt-4">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#a3e635]"
                style={{ animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: RESULTS ─────────────────────────────────────────────────────────
  if (stage === STAGE.RESULTS && sessionResult) {
    const avg = sessionResult.avg_score;
    const passed = avg >= 60;

    return (
      <div className="fixed inset-0 bg-[#050505] overflow-y-auto z-50">
        <ParticleField />
        <div className="relative z-10 min-h-full flex items-start justify-center py-12 px-4">
          <div className="w-full max-w-2xl space-y-6">
            {/* Header resultado */}
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1 mb-4 border ${
                passed ? 'bg-[#a3e635]/10 border-[#a3e635]/30 text-[#a3e635]' : 'bg-red-900/20 border-red-700/30 text-red-400'
              }`}>
                <span className="font-mono text-xs tracking-widest">
                  {passed ? 'ORAL REVIEW APROBADA' : 'ORAL REVIEW REPROBADA'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{sessionResult.topic}</h2>
              <p className="text-gray-500 font-mono text-xs">
                {sessionResult.questions_answered} preguntas · {new Date(sessionResult.completed_at).toLocaleString()}
              </p>
            </div>

            {/* Score central */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
              <ScoreRing score={avg} />
              <p className="text-gray-400 font-mono text-sm mt-4">Puntuación promedio</p>
              <p className={`text-lg font-bold mt-1 ${
                avg >= 80 ? 'text-[#a3e635]' : avg >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {avg >= 80 ? 'Excelente dominio' : avg >= 60 ? 'Dominio aceptable' : 'Necesita refuerzo'}
              </p>
            </div>

            {/* Resumen IA */}
            {sessionResult.summary && (
              <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-4">
                <h3 className="font-mono text-xs text-gray-400 tracking-widest uppercase">
                  Análisis del Examinador IA
                </h3>
                <p className="text-gray-200 text-sm leading-relaxed">{sessionResult.summary.overall_assessment}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#a3e635]/5 border border-[#a3e635]/20 rounded-lg p-3">
                    <p className="font-mono text-[10px] text-[#a3e635] mb-1 uppercase tracking-wide">Punto fuerte</p>
                    <p className="text-gray-300 text-xs">{sessionResult.summary.strongest_area}</p>
                  </div>
                  <div className="bg-yellow-900/10 border border-yellow-700/20 rounded-lg p-3">
                    <p className="font-mono text-[10px] text-yellow-400 mb-1 uppercase tracking-wide">A mejorar</p>
                    <p className="text-gray-300 text-xs">{sessionResult.summary.improvement_area}</p>
                  </div>
                </div>
                <div className="bg-blue-900/10 border border-blue-700/20 rounded-lg p-3">
                  <p className="font-mono text-[10px] text-blue-400 mb-1 uppercase tracking-wide">Recomendación</p>
                  <p className="text-gray-300 text-xs">{sessionResult.summary.recommendation}</p>
                </div>
              </div>
            )}

            {/* Desglose por pregunta */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-4">
              <h3 className="font-mono text-xs text-gray-400 tracking-widest uppercase">Desglose por Pregunta</h3>
              {sessionResult.answers.map((a, i) => (
                <div key={i} className="border border-[#1a1a1a] rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-gray-300 text-sm flex-1">{a.question}</p>
                    <ScoreRing score={a.evaluation.score} />
                  </div>
                  <p className="text-gray-500 text-xs italic">"{a.answer.slice(0, 120)}{a.answer.length > 120 ? '...' : ''}"</p>
                  <p className="text-gray-300 text-xs leading-relaxed">{a.evaluation.feedback}</p>
                  {a.evaluation.model_answer_hint && (
                    <p className="font-mono text-[10px] text-[#a3e635]/60">
                      Pista: {a.evaluation.model_answer_hint}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Métrica registrada */}
            <div className="bg-[#a3e635]/5 border border-[#a3e635]/20 rounded-xl p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-[#a3e635]/20 flex items-center justify-center flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-[#a3e635]" />
              </div>
              <div>
                <p className="font-mono text-xs text-[#a3e635] tracking-wide">MÉTRICA REGISTRADA</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  oral_evaluations += {sessionResult.oral_evaluation_passed} · Este resultado puede vincularse a tus compromisos activos.
                </p>
              </div>
            </div>

            <button
              onClick={restart}
              className="w-full py-3 border border-[#333] text-gray-400 font-mono text-sm rounded-lg
                hover:border-[#a3e635]/40 hover:text-[#a3e635] transition-colors"
            >
              ← NUEVA SESIÓN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: ENTORNO VR (READY / LISTENING / EVALUATING / FEEDBACK) ──────────
  const currentQuestion = questions[currentIdx];

  return (
    <div className="fixed inset-0 bg-[#050505] flex flex-col z-50">
      <ParticleField />

      {/* HUD superior */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#111]">
        <div className="flex items-center gap-3">
          <button onClick={restart} className="font-mono text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← SALIR
          </button>
          <span className="text-[#222]">|</span>
          <span className="font-mono text-xs text-gray-500 tracking-wider truncate max-w-xs">
            {topic.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Progreso de preguntas */}
          <div className="flex gap-1.5">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i < currentIdx ? 'w-6 bg-[#a3e635]' :
                  i === currentIdx ? 'w-6 bg-[#a3e635]/60' :
                  'w-3 bg-[#222]'
                }`}
              />
            ))}
          </div>
          <span className="font-mono text-xs text-gray-500">
            {currentIdx + 1}/{questions.length}
          </span>
        </div>
      </div>

      {/* Área principal */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
        <HologramAvatar stage={stage} />

        {/* Pregunta */}
        <div className="w-full max-w-2xl text-center">
          {stage === STAGE.READY && (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-[#111] border border-[#222] rounded-full px-3 py-1">
                <span className="font-mono text-[10px] text-gray-500 tracking-widest">
                  PREGUNTA {currentIdx + 1} · {currentQuestion?.difficulty?.toUpperCase()}
                </span>
              </div>
              <p className="text-white text-xl leading-relaxed font-light px-4">
                {currentQuestion?.text}
              </p>
            </div>
          )}

          {stage === STAGE.LISTENING && (
            <div className="space-y-6">
              <p className="text-gray-300 text-lg leading-relaxed font-light px-4">
                {currentQuestion?.text}
              </p>
              {/* Transcripción en tiempo real */}
              <div className="bg-[#111] border border-[#a3e635]/20 rounded-xl px-6 py-4 min-h-[80px] text-left">
                <p className="font-mono text-[10px] text-[#a3e635]/60 mb-2 tracking-widest">TRANSCRIPCIÓN EN VIVO</p>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {transcript || (
                    <span className="text-gray-600 italic">Habla ahora...</span>
                  )}
                </p>
              </div>
              <div className="flex justify-center">
                <AudioWaveform active={isRecording} />
              </div>
            </div>
          )}

          {stage === STAGE.EVALUATING && (
            <div className="space-y-4">
              <p className="font-mono text-[#a3e635] text-sm tracking-wider animate-pulse">
                {loadingMsg || 'Analizando tu respuesta...'}
              </p>
              <div className="w-48 h-px bg-gradient-to-r from-transparent via-[#a3e635]/40 to-transparent mx-auto
                animate-pulse" />
            </div>
          )}

          {stage === STAGE.FEEDBACK && currentEval && (
            <div className="space-y-4 w-full max-w-2xl">
              <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <ScoreRing score={currentEval.score} />
                  <div className="text-left">
                    <p className="font-mono text-xs text-gray-500 tracking-wide uppercase">{currentEval.level}</p>
                    <p className="text-white text-sm mt-1 leading-relaxed">{currentEval.feedback}</p>
                  </div>
                </div>

                {currentEval.correct_points?.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {currentEval.correct_points.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[#a3e635] text-xs mt-0.5">✓</span>
                        <span className="text-gray-400 text-xs">{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {currentEval.missing_points?.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {currentEval.missing_points.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-yellow-400 text-xs mt-0.5">○</span>
                        <span className="text-gray-400 text-xs">{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {currentEval.model_answer_hint && (
                  <div className="mt-3 border-t border-[#1a1a1a] pt-3">
                    <p className="font-mono text-[10px] text-[#a3e635]/60 mb-1">PISTA</p>
                    <p className="text-gray-400 text-xs italic">{currentEval.model_answer_hint}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles inferiores */}
      <div className="relative z-10 px-6 py-6 border-t border-[#111]">
        {error && (
          <p className="font-mono text-red-400 text-xs text-center mb-4">{error}</p>
        )}

        <div className="flex items-center justify-center gap-4 max-w-lg mx-auto">
          {stage === STAGE.READY && (
            <>
              {speechSupported ? (
                <button
                  onClick={startListening}
                  className="flex-1 py-3 bg-[#a3e635] text-black font-bold font-mono text-sm rounded-xl
                    tracking-wide hover:bg-[#bef264] transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 8V4a1 1 0 0 1 2 0v5h-2zm-5 1a6 6 0 0 0 12 0h-2a4 4 0 0 1-8 0H6zm5 6.93V21h-2v-4.07A8 8 0 0 1 4 9h2a6 6 0 0 0 12 0h2a8 8 0 0 1-7 7.93z"/>
                  </svg>
                  HABLAR RESPUESTA
                </button>
              ) : (
                <button
                  onClick={() => { setStage(STAGE.LISTENING); setTranscript(''); }}
                  className="flex-1 py-3 bg-[#a3e635] text-black font-bold font-mono text-sm rounded-xl tracking-wide hover:bg-[#bef264] transition-colors"
                >
                  ESCRIBIR RESPUESTA
                </button>
              )}
            </>
          )}

          {stage === STAGE.LISTENING && (
            <>
              {!speechSupported && (
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  className="flex-1 bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white text-sm
                    placeholder-gray-600 focus:outline-none focus:border-[#a3e635]/50 resize-none h-16 font-mono"
                />
              )}
              <button
                onClick={submitAnswer}
                disabled={!transcript.trim()}
                className="flex-1 py-3 bg-blue-600 text-white font-bold font-mono text-sm rounded-xl
                  tracking-wide hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRecording ? 'DETENER Y EVALUAR' : 'ENVIAR RESPUESTA'}
              </button>
              {isRecording && (
                <button
                  onClick={stopListening}
                  className="py-3 px-4 bg-[#111] border border-[#333] text-gray-400 font-mono text-xs rounded-xl hover:border-[#a3e635]/40 transition-colors"
                >
                  PAUSA
                </button>
              )}
            </>
          )}

          {stage === STAGE.FEEDBACK && (
            <button
              onClick={nextQuestion}
              className="flex-1 py-3 bg-[#a3e635] text-black font-bold font-mono text-sm rounded-xl
                tracking-wide hover:bg-[#bef264] transition-colors"
            >
              {currentIdx + 1 >= questions.length ? 'VER RESULTADOS FINALES →' : 'SIGUIENTE PREGUNTA →'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float { 0% { transform: translateY(0px); opacity: 0.3; } 100% { transform: translateY(-20px); opacity: 0; } }
        @keyframes wave { from { height: 4px; } to { height: 28px; } }
      `}</style>
    </div>
  );
}
