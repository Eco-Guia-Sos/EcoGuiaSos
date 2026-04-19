-- EcoGuía SOS: Ecosistema de Compromiso - Initial Schema
-- Phase 22: Data Foundation

-- 1. Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'actor', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('pending', 'approved', 'full', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles table (Extends Auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role user_role DEFAULT 'user',
    is_validated BOOLEAN DEFAULT false,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ig_handle TEXT,
    wa_contact TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location_name TEXT,
    coordinates POINT, -- For MapLibre integration
    external_link TEXT,
    status event_status DEFAULT 'pending',
    allow_cloning BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Registrations table (Interesados)
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Profiles: Users can read all profiles, but only edit their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Organizations: Everyone can view, but only creator or admin can edit
CREATE POLICY "Organizations are viewable by everyone" ON public.organizations
    FOR SELECT USING (true);
CREATE POLICY "Creators or admins can manage organizations" ON public.organizations
    FOR ALL USING (
        auth.uid() = creator_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Events: Everyone can view approved/full events. Authors can manage all events.
CREATE POLICY "All can view approved events" ON public.events
    FOR SELECT USING (status IN ('approved', 'full') OR auth.uid() IN (
        SELECT creator_id FROM public.organizations WHERE id = org_id
    ));
CREATE POLICY "Actors can manage own events" ON public.events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND creator_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Registrations: Users can manage their own registrations. Admins/Actors can view list.
CREATE POLICY "Users can manage own registrations" ON public.registrations
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Actors can view registrations for their events" ON public.registrations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.events e JOIN public.organizations o ON e.org_id = o.id WHERE e.id = event_id AND o.creator_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 8. Triggers for Profile Creation
-- Automatically creates a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
