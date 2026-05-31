-- PostgreSQL schema for productionizing Team Outing Expense Tracker.
-- The demo app uses server/data/store.json, but this schema maps the same data model cleanly.

CREATE TYPE user_role AS ENUM ('admin', 'member', 'finance');
CREATE TYPE attendance_status AS ENUM ('attending', 'not-attending', 'tentative');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE split_method AS ENUM ('equal', 'selected', 'custom', 'percentage');
CREATE TYPE settlement_status AS ENUM ('pending', 'partially-paid', 'completed');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT NOT NULL,
  estimated_budget NUMERIC(12,2) NOT NULL CHECK (estimated_budget >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  organizer_user_id UUID REFERENCES users(id),
  settlement_deadline DATE,
  status TEXT NOT NULL DEFAULT 'planning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  email_or_phone TEXT NOT NULL,
  attendance_status attendance_status NOT NULL DEFAULT 'attending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id UUID NOT NULL REFERENCES categories(id),
  expense_date DATE NOT NULL,
  paid_by_participant_id UUID NOT NULL REFERENCES participants(id),
  split_method split_method NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  approval_status approval_status NOT NULL DEFAULT 'pending',
  created_by_user_id UUID REFERENCES users(id),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  is_settled_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expense_participants (
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id),
  PRIMARY KEY (expense_id, participant_id)
);

CREATE TABLE splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id),
  amount NUMERIC(12,2),
  percentage NUMERIC(5,2),
  CHECK (amount IS NULL OR amount >= 0),
  CHECK (percentage IS NULL OR percentage >= 0)
);

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  uploaded_by_user_id UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_participant_id UUID NOT NULL REFERENCES participants(id),
  to_participant_id UUID NOT NULL REFERENCES participants(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status settlement_status NOT NULL DEFAULT 'pending',
  transaction_reference TEXT,
  payment_proof_url TEXT,
  updated_at TIMESTAMPTZ
);
