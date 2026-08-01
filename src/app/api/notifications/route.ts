import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface Notification {
  id: string;
  user_id: string;
  type: 'risk' | 'profit' | 'news' | 'market' | 'info';
  title: string;
  message: string;
  ticker: string | null;
  read: boolean;
  created_at: string;
  priority: 'high' | 'normal' | 'low';
  action_url: string | null;
}

// GET — last 20 notifications for current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      // Table may not exist yet
      return NextResponse.json({ notifications: [] });
    }

    return NextResponse.json({ notifications: (data ?? []) as Notification[] });
  } catch (err: unknown) {
    console.error('[notifications GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — mark notification(s) as read
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.id && !body.all) {
    return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 });
  }

  try {
    if (body.all) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    } else if (body.id) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', body.id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[notifications PATCH]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
