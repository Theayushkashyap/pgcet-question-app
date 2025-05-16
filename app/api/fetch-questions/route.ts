// app/api/fetch-questions/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { fetchQuestionsFromSource } from '../../../lib/parser';

export async function GET() {
  try {
    const sources = [
      'https://example.com/pgcet-2023-questions.html',
      // add more URLs here
    ];

    let allQs: any[] = [];
    for (const url of sources) {
      const qs = await fetchQuestionsFromSource(url);
      allQs = allQs.concat(qs);
    }

    const { error } = await supabaseAdmin
      .from('questions')
      .upsert(
        allQs.map(q => ({
          question_text: q.text,
          options:        q.options,
          answer:         q.answer,
          source_url:     q.source,
          fetched_at:     new Date().toISOString(),
        })),
        { onConflict: 'question_text' }
      );

    if (error) throw error;
    return NextResponse.json({ inserted: allQs.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
