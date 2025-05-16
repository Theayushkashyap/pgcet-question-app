import axios from 'axios';
// import * as cheerio from 'cheerio';        // ❌ No default export
import { load } from 'cheerio';               // ✅ Named import

export interface Question {
  text: string;
  options: string[];
  answer: string;
  source: string;
}

export async function fetchQuestionsFromSource(url: string): Promise<Question[]> {
  const { data } = await axios.get(url);
  const $ = load(data);
  const questions: Question[] = [];

  // TODO: update selectors to match your source pages
  $('.question-block').each((_, el) => {
    const text    = $(el).find('.q-text').text().trim();
    const options = ['.optA', '.optB', '.optC', '.optD'].map(sel => $(el).find(sel).text().trim());
    const answer  = $(el).find('.answer').text().trim();
    if (text && options.every(o => o) && answer) {
      questions.push({ text, options, answer, source: url });
    }
  });

  return questions;
}
