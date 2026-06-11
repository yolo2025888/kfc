-- Create Avatar Library Table
CREATE TABLE IF NOT EXISTS public.avatar_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.avatar_library ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access" ON public.avatar_library
    FOR SELECT USING (true);

CREATE POLICY "Allow admin full access" ON public.avatar_library
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'super-admin')
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_avatar_library_updated_at
    BEFORE UPDATE ON public.avatar_library
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
