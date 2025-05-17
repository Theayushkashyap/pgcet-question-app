import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabaseClient';

// Define the shape of a question record in the database
export interface Question {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
}

/**
 * GET /api/fetch-questions
 * Fetches all MCQ questions from the Supabase table.
 */
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabaseClient
      .from('mcq_questions')
      .select<Question, {
        id: number;
        question: string;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        answer: string;
      }>('id, question, option_a, option_b, option_c, option_d, answer')
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { questions: data ?? [] },
      { status: 200 }
    );
  } catch (err) {
    console.error('Unexpected error in GET /api/fetch-questions:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
