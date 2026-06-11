-- HyperCRM Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Create custom types
CREATE TYPE user_role AS ENUM ('MASTER', 'ADMIN', 'ASSOCIATE');
CREATE TYPE contact_status AS ENUM ('Lead', 'Prospect', 'Customer', 'Churned');
CREATE TYPE activity_type AS ENUM ('note', 'email', 'call', 'meeting', 'document', 'status_change', 'creation');

-- Workspaces table (multi-tenancy)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'ASSOCIATE',
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    status contact_status NOT NULL DEFAULT 'Lead',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id)
);

-- Activities table (contact timeline)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type activity_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard widget layouts (per user)
CREATE TABLE dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    widgets JSONB NOT NULL DEFAULT '[]',
    hidden_widgets JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, workspace_id)
);

-- Indexes for performance
CREATE INDEX idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_workspace ON activities(workspace_id);
CREATE INDEX idx_users_workspace ON users(workspace_id);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_layouts_updated_at BEFORE UPDATE ON dashboard_layouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Workspaces: Users can view their own workspace
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace" ON workspaces
    FOR SELECT USING (
        id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

-- Users: Users can view others in same workspace
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own record
CREATE POLICY "Users can view own record" ON users
    FOR SELECT USING (
        id = auth.uid()
    );

-- Users can view others in same workspace (using a security definer function to avoid recursion)
CREATE OR REPLACE FUNCTION get_user_workspace_id()
RETURNS UUID AS $$
DECLARE
    ws_id UUID;
BEGIN
    SELECT workspace_id INTO ws_id FROM users WHERE id = auth.uid();
    RETURN ws_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view workspace members" ON users
    FOR SELECT USING (
        workspace_id = get_user_workspace_id()
    );

-- Contacts: Workspace-level access
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace contacts" ON contacts
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can create workspace contacts" ON contacts
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can update workspace contacts" ON contacts
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can delete workspace contacts" ON contacts
    FOR DELETE USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

-- Activities: Workspace-level access
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace activities" ON activities
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can create workspace activities" ON activities
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can update workspace activities" ON activities
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can delete workspace activities" ON activities
    FOR DELETE USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

-- Dashboard layouts: User-level access
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own layout" ON dashboard_layouts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own layout" ON dashboard_layouts
    FOR ALL USING (user_id = auth.uid());

-- Create initial workspace and user function
CREATE OR REPLACE FUNCTION create_initial_workspace_and_user()
RETURNS TRIGGER AS $$
DECLARE
    new_workspace_id UUID;
BEGIN
    -- Create a new workspace
    INSERT INTO workspaces (name, slug)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'company_name', 'Workspace for ' || NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'company_slug', 'workspace-' || substr(md5(random()::text), 1, 8))
    )
    RETURNING id INTO new_workspace_id;
    
    -- Create user record with MASTER role
    INSERT INTO users (id, email, workspace_id, role, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        new_workspace_id,
        'MASTER',
        COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    
    -- Create default dashboard layout
    INSERT INTO dashboard_layouts (user_id, workspace_id, widgets, hidden_widgets)
    VALUES (
        NEW.id,
        new_workspace_id,
        '[]'::jsonb,
        '[]'::jsonb
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create workspace and user on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_initial_workspace_and_user();
