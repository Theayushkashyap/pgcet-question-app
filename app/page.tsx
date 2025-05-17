'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';

interface Question {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
  year: number;
  explanation: string;
}

interface StatRow {
  date: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  year: number;
  questions: {
    question: string;
    selectedOption: string;
    correctAnswer: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    year: number;
    explanation: string;
    isCorrect: boolean;
  }[];
}

interface UserAnswer {
  created_at: string;
  selected_option: string;
  is_correct: boolean;
  mcq_questions: {
    question: string;
    answer: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    year: number;
    explanation: string;
  };
}

interface QuizAttempt {
  id?: number;
  created_at?: string;
  year: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  questions: {
    question_id: number;
    question: string;
    selected_option: string;
    correct_answer: string;
    is_correct: boolean;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    explanation: string;
  }[];
}

interface QuizAttemptResponse {
  id: number;
  created_at: string;
  year: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  question_responses: {
    selected_option: string;
    is_correct: boolean;
    mcq_questions: {
      question: string;
      answer: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      explanation: string;
    };
  }[];
}

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTab, setActiveTab] = useState<'quiz' | 'stats'>('quiz');
  const [stats, setStats] = useState<StatRow[]>([]);
  const [feedbackClass, setFeedbackClass] = useState<string>('');
  const [feedbackState, setFeedbackState] = useState<'correct' | 'incorrect' | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(null);

  // Fetch list of years with questions
  const fetchAvailableYears = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('mcq_questions')
        .select('year')
        .order('year', { ascending: false });

      if (!error && data) {
        const years = [...new Set(data.map(q => q.year))];
        setAvailableYears(years);
      }
    } catch (err) {
      console.error('Error fetching years:', err);
    }
  };

  // Fetch questions for a given year
  const fetchQuestions = async (year: number) => {
    try {
      const { data, error } = await supabaseClient
        .from<Question>('mcq_questions')
        .select('id, question, option_a, option_b, option_c, option_d, answer');

      if (error) {
        setError(error.message);
        setQuestions([]);
      } else if (data) {
        setQuestions(data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats of all answers grouped by date
  const fetchStats = async () => {
    try {
      const { data: attempts, error: attemptsError } = await supabaseClient
        .from('quiz_attempts')
        .select(`
          id,
          created_at,
          year,
          total_questions,
          correct_answers,
          wrong_answers,
          question_responses (
            selected_option,
            is_correct,
            mcq_questions (
              question,
              answer,
              option_a,
              option_b,
              option_c,
              option_d,
              explanation
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      const formattedStats: StatRow[] = (attempts as unknown as QuizAttemptResponse[]).map(attempt => ({
        date: new Date(attempt.created_at).toISOString().split('T')[0],
        totalQuestions: attempt.total_questions,
        correctCount: attempt.correct_answers,
        wrongCount: attempt.wrong_answers,
        year: attempt.year,
        questions: attempt.question_responses.map(qr => ({
          question: qr.mcq_questions.question,
          selectedOption: qr.selected_option,
          correctAnswer: qr.mcq_questions.answer,
          optionA: qr.mcq_questions.option_a,
          optionB: qr.mcq_questions.option_b,
          optionC: qr.mcq_questions.option_c,
          optionD: qr.mcq_questions.option_d,
          explanation: qr.mcq_questions.explanation,
          isCorrect: qr.is_correct,
          year: attempt.year
        }))
      }));

      setStats(formattedStats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchAvailableYears();
  }, []);

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]);

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setLoading(true);
    fetchQuestions(year);
  };

  const handleStart = () => {
    setShowWelcome(false);
  };

  const handleSubmitOrNext = async () => {
    const current = questions[currentIndex];
    if (!submitted) {
      setSubmitted(true);
      if (selectedOption === current.answer) {
        setScore(prev => prev + 1);
      }
    } else {
      // Next question
      setSubmitted(false);
      setSelectedOption('');
      setFeedbackClass('');
      setFeedbackState(null);
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Quiz finished - save the attempt
        if (currentAttempt) {
          saveQuizAttempt(currentAttempt);
        }
        setFinished(true);
      }
    }
  };

  const saveQuizAttempt = async (attempt: QuizAttempt) => {
    try {
      // First, save the quiz attempt
      const { data: attemptData, error: attemptError } = await supabaseClient
        .from('quiz_attempts')
        .insert({
          year: attempt.year,
          total_questions: attempt.total_questions,
          correct_answers: attempt.correct_answers,
          wrong_answers: attempt.wrong_answers
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Then, save all question responses
      const questionResponses = attempt.questions.map(q => ({
        attempt_id: attemptData.id,
        question_id: q.question_id,
        selected_option: q.selected_option,
        is_correct: q.is_correct
      }));

      const { error: responsesError } = await supabaseClient
        .from('question_responses')
        .insert(questionResponses);

      if (responsesError) throw responsesError;

    } catch (err) {
      console.error('Error saving quiz attempt:', err);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption('');
    setSubmitted(false);
    setScore(0);
    setFinished(false);
    setError(null);
    setLoading(true);
    setShowWelcome(true);
    setActiveTab('quiz');
    fetchQuestions(selectedYear ?? 0);
  };

  // Welcome screen
  if (showWelcome) {
    return (
      <main className="p-8 text-center min-h-screen flex flex-col justify-center items-center glass">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-6xl font-bold mb-8 animate-welcome gradient-text">
            Welcome Deekshitha Jha!
          </h1>
          <p className="mb-12 text-2xl text-foreground/80 animate-welcome" style={{ animationDelay: '0.3s' }}>
            Choose a year to start your PGCET practice
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => handleYearSelect(year)}
                className={`px-8 py-4 rounded-xl transition-all hover-lift border-2 ${
                  selectedYear === year
                    ? 'bg-gradient-to-r from-primary to-primary-hover text-white border-primary/50'
                    : 'bg-secondary text-foreground border-secondary/50 hover:bg-secondary/80'
                }`}
              >
                PGCET {year}
              </button>
            ))}
          </div>
          {selectedYear && (
            <button
              onClick={handleStart}
              className="px-10 py-5 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:bg-primary-hover animate-welcome text-xl font-medium hover-lift border-2 border-primary/30 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl"
              style={{ animationDelay: '0.6s' }}
            >
              Start Quiz
            </button>
          )}
        </div>
      </main>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 text-center min-h-screen flex items-center justify-center">
        <div className="p-8 rounded-2xl glass">
          <p className="text-2xl loading">Loading…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="p-8 text-center min-h-screen flex flex-col items-center justify-center glass">
        <div className="max-w-md mx-auto">
          <p className="text-2xl text-error mb-8">Error: {error}</p>
          <button
            onClick={handleRestart}
            className="px-8 py-4 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 hover-lift"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // Main Quiz / Stats UI
  return (
    <main className="p-8 max-w-3xl mx-auto my-8 rounded-2xl glass">
      {/* ===== Tabs ===== */}
      <div className="flex mb-6 space-x-4">
        <button
          onClick={() => setActiveTab('quiz')}
          className={`px-4 py-2 rounded ${
            activeTab === 'quiz' ? 'bg-primary text-white' : 'bg-secondary text-foreground'
          }`}
        >
          Quiz
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded ${
            activeTab === 'stats' ? 'bg-primary text-white' : 'bg-secondary text-foreground'
          }`}
        >
          Stats
        </button>
      </main>
    );
  }

  // Quiz content
  const current = questions[currentIndex];
  const options = [
    current.option_a,
    current.option_b,
    current.option_c,
    current.option_d,
  ];

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">PGCET MCQ Quiz</h1>

      {finished ? (
        <div className="text-center">
          <p className="text-2xl mb-4">Quiz Complete!</p>
          <p className="text-xl">
            Score: {score} / {questions.length}
          </p>
          <button
            onClick={handleRestart}
            className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Restart Quiz
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <p className="font-medium mb-4">{current.question}</p>

          <div className="space-y-3 mb-6">
            {options.map((opt, idx) => {
              const isCorrect =
                submitted && opt === current.answer;
              const isSelectedWrong =
                submitted &&
                opt === selectedOption &&
                selectedOption !== current.answer;

                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => {
                          if (!submitted) {
                            setSelectedOption(optionValue);
                          }
                        }}
                        disabled={submitted}
                        className={`p-4 rounded-xl text-left transition-all ${
                          submitted
                            ? isCorrect
                              ? 'bg-success/20 text-success border-2 border-success'
                              : isWrong
                                ? 'bg-error/20 text-error border-2 border-error'
                                : isSelected
                                  ? 'bg-primary/20 text-primary border-2 border-primary ring-2 ring-primary/30'
                                  : 'bg-secondary/50 border-2 border-secondary'
                            : isSelected
                              ? 'bg-primary/20 text-primary border-2 border-primary ring-2 ring-primary/30'
                              : 'bg-secondary/50 hover:bg-secondary/70 border-2 border-secondary/50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            submitted
                              ? isCorrect
                                ? 'bg-success/30 text-success'
                                : isWrong
                                  ? 'bg-error/30 text-error'
                                  : isSelected
                                    ? 'bg-primary/30 text-primary ring-2 ring-primary/30'
                                    : 'bg-secondary/70'
                              : isSelected
                                ? 'bg-primary/30 text-primary ring-2 ring-primary/30'
                                : 'bg-secondary/70'
                          }`}>
                            {letter.toUpperCase()}
                          </div>
                          <span className={`text-lg ${isSelected ? 'font-medium' : ''}`}>{optionValue}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-foreground/60">
                  Score: {score} / {questions.length}
                </div>
                <button
                  onClick={handleSubmitOrNext}
                  disabled={!submitted && !selectedOption}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:from-primary-hover hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitted
                    ? currentIndex + 1 === questions.length
                      ? 'Finish'
                      : 'Next'
                    : 'Submit'}
                </button>
              </div>
              {submitted && (
                <div className="mt-8 space-y-4">
                  {feedbackState === 'correct' ? (
                    <div className="p-6 bg-success/20 rounded-xl text-center">
                      <div className="flex items-center justify-center space-x-2 text-success text-xl mb-4">
                        <span>✓</span>
                        <span>Correct!</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-error/20 rounded-xl text-center">
                      <div className="flex items-center justify-center space-x-2 text-error text-xl mb-4">
                        <span>✕</span>
                        <span>Incorrect</span>
                      </div>
                      <div className="text-error">
                        <p className="font-medium mb-2">Correct Answer:</p>
                        <p>{questions[currentIndex].answer}</p>
                      </div>
                    </div>
                  )}
                  <div className="p-6 bg-primary/10 rounded-xl space-y-4">
                    <div className="border-b border-primary/20 pb-4">
                      <h3 className="text-primary font-medium mb-2">Question Analysis:</h3>
                      <p className="text-primary/80">{questions[currentIndex].question}</p>
                    </div>
                    
                    <div className="border-b border-primary/20 pb-4">
                      <h3 className="text-primary font-medium mb-2">Your Answer:</h3>
                      <p className={`${feedbackState === 'correct' ? 'text-success' : 'text-error'}`}>
                        {selectedOption}
                      </p>
                    </div>

                    <div className="border-b border-primary/20 pb-4">
                      <h3 className="text-primary font-medium mb-2">Correct Answer:</h3>
                      <p className="text-success">
                        {questions[currentIndex].answer}
                      </p>
                    </div>

                    {questions[currentIndex].explanation && (
                      <div>
                        <h3 className="text-primary font-medium mb-2">Detailed Explanation:</h3>
                        <p className="text-primary/80">{questions[currentIndex].explanation}</p>
                      </div>
                    )}

                    <div className="pt-4">
                      <h3 className="text-primary font-medium mb-2">Key Points:</h3>
                      <ul className="list-disc list-inside space-y-2 text-primary/80">
                        <li>This question is from PGCET {questions[currentIndex].year}</li>
                        <li>Make sure to understand the concept thoroughly</li>
                        <li>Review related topics if needed</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        // ========== STATS VIEW ==========
        <div className="space-y-4">
          {stats.map(row => (
            <div key={row.date} className="border-b pb-4">
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() =>
                  setExpandedDate(expandedDate === row.date ? null : row.date)
                }
              >
                <div className="font-medium">
                  {row.date} — {row.totalQuestions} questions
                  <span className="ml-2 text-success">({row.correctCount} correct)</span>
                  <span className="ml-2 text-error">({row.wrongCount} wrong)</span>
                </div>
                <div>{expandedDate === row.date ? '▾' : '▸'}</div>
              </div>
              {expandedDate === row.date && (
                <ul className="mt-2 pl-4 space-y-6">
                  {row.questions.map((q, i) => (
                    <li key={i} className="bg-secondary/20 p-4 rounded-xl">
                      <div className="mb-3">
                        <span className={`text-lg font-medium ${q.isCorrect ? 'text-success' : 'text-error'}`}>
                          {q.isCorrect ? '✓' : '✕'}
                        </span>
                        <span className="ml-2 text-lg font-medium">Question {i + 1}</span>
                      </div>
                      <div className="mb-3">
                        <strong className="text-foreground/80">Question:</strong>
                        <p className="mt-1 text-foreground">{q.question}</p>
                      </div>
                      <div className="space-y-2 mb-3">
                        <strong className="text-foreground/80 block mb-2">Options:</strong>
                        {['A', 'B', 'C', 'D'].map((option) => {
                          const optionValue = q[`option${option}` as keyof typeof q];
                          const isCorrect = optionValue === q.correctAnswer;
                          const isSelected = optionValue === q.selectedOption;
                          
                          return (
                            <div
                              key={option}
                              className={`p-3 rounded-lg flex items-center space-x-3 ${
                                isCorrect
                                  ? 'bg-success/10 border-2 border-success'
                                  : isSelected
                                    ? 'bg-error/10 border-2 border-error'
                                    : 'bg-secondary/10 border-2 border-secondary/50'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                isCorrect
                                  ? 'bg-success/30 text-success'
                                  : isSelected
                                    ? 'bg-error/30 text-error'
                                    : 'bg-secondary/30'
                              }`}>
                                {option}
                              </div>
                              <span className={`${
                                isCorrect
                                  ? 'text-success'
                                  : isSelected
                                    ? 'text-error'
                                    : 'text-foreground/80'
                              }`}>
                                {optionValue}
                              </span>
                              {isCorrect && (
                                <span className="ml-auto text-success font-medium">
                                  ✓ Correct Answer
                                </span>
                              )}
                              {isSelected && !isCorrect && (
                                <span className="ml-auto text-error font-medium">
                                  ✕ Your Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div className="bg-primary/10 p-3 rounded-lg">
                          <strong className="text-primary block mb-1">Explanation:</strong>
                          <p className="text-primary/80">{q.explanation}</p>
                        </div>
                      )}
                      <div className="mt-3 text-sm text-foreground/60">
                        PGCET {q.year}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
