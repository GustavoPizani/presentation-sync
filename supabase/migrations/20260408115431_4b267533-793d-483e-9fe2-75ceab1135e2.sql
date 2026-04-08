
-- Create sessions table for playbook presentation sync
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL UNIQUE,
  current_slide INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read sessions (needed for remote control)
CREATE POLICY "Anyone can read sessions" ON public.sessions FOR SELECT USING (true);

-- Allow anyone to insert sessions (viewer creates on load)
CREATE POLICY "Anyone can create sessions" ON public.sessions FOR INSERT WITH CHECK (true);

-- Allow anyone to update sessions (remote control updates slide)
CREATE POLICY "Anyone can update sessions" ON public.sessions FOR UPDATE USING (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.update_sessions_updated_at();
