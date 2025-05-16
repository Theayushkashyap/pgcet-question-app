import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { count, error } = await supabaseAdmin
    .from('questions')
    .select('*', { head: true, count: 'exact' });

  if (error) return res.status(500).json({ error });
  return res.status(200).json({ questionCount: count });
}
