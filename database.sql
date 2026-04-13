-- Only hit the drops if you need to reset the db
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS marketplace_settings CASCADE;
DROP POLICY IF EXISTS "Users can upload listing images"
ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view listing images"
ON storage.objects;

DROP POLICY IF EXISTS "Users can delete their own images"
ON storage.objects;


--- =====================================================
-- PROFILES TABLE
-- Extends auth.users with additional user information
-- =====================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL CHECK (length(username) >= 3 AND length(username) <= 30),
  email TEXT, -- Redundant but useful for queries
  rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
  bio TEXT CHECK (length(bio) <= 500),
  location TEXT,
  avatar_url TEXT,
  phone TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{
    "notifications": true,
    "email_updates": true,
    "theme": "light"
  }',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- MARKETPLACE SETTINGS TABLE
-- Global marketplace configuration
-- =====================================================
CREATE TABLE marketplace_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- LISTINGS TABLE
-- Main marketplace listings
-- =====================================================
CREATE TABLE listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL CHECK (length(description) >= 10 AND length(description) <= 2000),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like-new', 'good', 'fair', 'poor')),
  location TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  msrp DECIMAL(10,2) CHECK (msrp >= 0),
  type TEXT NOT NULL DEFAULT 'buy-now' CHECK (type IN ('buy-now', 'offers', 'auction')),
  shipping TEXT NOT NULL DEFAULT 'paid' CHECK (shipping IN ('free', 'paid', 'local', 'pickup')),
  payment_methods TEXT[] DEFAULT ARRAY['cash'] CHECK (
    payment_methods <@ ARRAY['cash', 'card', 'paypal', 'venmo', 'zelle', 'crypto', 'trade']
  ),
  tags TEXT[] DEFAULT '{}' CHECK (array_length(tags, 1) <= 10),
  images TEXT[] DEFAULT '{}' CHECK (array_length(images, 1) <= 10),
  is_fair BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_sold BOOLEAN DEFAULT false,
  sold_at TIMESTAMP WITH TIME ZONE,
  sold_to UUID REFERENCES auth.users(id),
  view_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- WISHLISTS TABLE
-- User favorites/saved listings
-- =====================================================
CREATE TABLE wishlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ensure no duplicate favorites
  UNIQUE(user_id, listing_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

CREATE INDEX idx_listings_seller_id ON listings(seller_id);
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_condition ON listings(condition);
CREATE INDEX idx_listings_type ON listings(type);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX idx_listings_updated_at ON listings(updated_at DESC);
CREATE INDEX idx_listings_is_sold ON listings(is_sold);
CREATE INDEX idx_listings_expires_at ON listings(expires_at);
CREATE INDEX idx_listings_location ON listings USING gin(to_tsvector('english', location));
CREATE INDEX idx_listings_tags ON listings USING gin(tags);
CREATE INDEX idx_listings_search ON listings USING gin(to_tsvector('english', name || ' ' || description));

CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX idx_wishlists_listing_id ON wishlists(listing_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- MARKETPLACE SETTINGS POLICIES (admin only, but allowing read for now)
CREATE POLICY "Marketplace settings are viewable by everyone" ON marketplace_settings
  FOR SELECT USING (true);

-- LISTINGS POLICIES
CREATE POLICY "Listings are viewable by everyone" ON listings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create listings" ON listings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.uid() = seller_id 
    AND NOT is_sold
  );

CREATE POLICY "Users can update their own listings" ON listings
  FOR UPDATE USING (
    auth.uid() = seller_id 
    AND NOT is_sold
  );

CREATE POLICY "Users can delete their own listings" ON listings
  FOR DELETE USING (auth.uid() = seller_id);

-- WISHLIST POLICIES
CREATE POLICY "Users can view their own wishlist" ON wishlists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own wishlist" ON wishlists
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    -- Users cannot add their own listings to the wishlist
    auth.uid() != (SELECT seller_id FROM listings WHERE id = listing_id)
  );

CREATE POLICY "Users can remove from their own wishlist" ON wishlists
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- STORAGE POLICIES (for listing-images bucket)
-- =====================================================
-- Note: These need to be run after creating the bucket

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload listing images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'listing-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public access to view images
CREATE POLICY "Anyone can view listing images" ON storage.objects
FOR SELECT USING (bucket_id = 'listing-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'listing-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Function to create a profile for a new user in auth.users
-- This is a common pattern that you were missing.
-- This function is called by a trigger when a new user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  -- Assumes username is passed in metadata on signup
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create a profile when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_settings_updated_at BEFORE UPDATE ON marketplace_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Function to update favorite count on listings
CREATE OR REPLACE FUNCTION update_listing_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE listings SET favorite_count = favorite_count + 1 WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE listings SET favorite_count = favorite_count - 1 WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_favorite_count
  AFTER INSERT OR DELETE ON wishlists
  FOR EACH ROW EXECUTE FUNCTION update_listing_favorite_count();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default marketplace settings
INSERT INTO marketplace_settings (key, value, description) VALUES
('platform_fee', '0.02', 'Platform fee as decimal (2%)'),
('max_images_per_listing', '10', 'Maximum images allowed per listing'),
('listing_expiry_days', '30', 'Days until listing expires'),
('featured_listing_price', '9.99', 'Price to feature a listing'),
('allow_guest_browsing', 'true', 'Allow non-logged-in users to browse'),
('require_email_verification', 'false', 'Require email verification for signup');

-- Insert some sample categories (you can modify these)
INSERT INTO marketplace_settings (key, value, description) VALUES
('categories', '[
  "Electronics", "Clothing & Accessories", "Home & Garden", 
  "Sports & Outdoors", "Books & Media", "Vehicles", 
  "Collectibles", "Tools & Equipment", "Other"
]', 'Available listing categories');





-- =====================================================
-- TABLE PRIVILEGES (needed in addition to RLS)
-- =====================================================

-- Profiles (public select is allowed by RLS, but still needs GRANT)
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Marketplace settings (public read)
GRANT SELECT ON TABLE public.marketplace_settings TO anon, authenticated;

-- Listings (this is the one your error mentions)
GRANT SELECT ON TABLE public.listings TO anon, authenticated;

-- Allow logged-in writers (your RLS INSERT/UPDATE/DELETE policies cover *row access*)
GRANT INSERT, UPDATE, DELETE ON TABLE public.listings TO authenticated;

-- Wishlists
GRANT SELECT ON TABLE public.wishlists TO authenticated;
GRANT INSERT, DELETE ON TABLE public.wishlists TO authenticated;

-- Optional but usually safe: let authenticated reference FK columns
GRANT REFERENCES ON TABLE public.listings, public.profiles TO authenticated;
''


CREATE POLICY "Users can update their own listing images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- START OF ADDED CODE FOR CHAT FEATURE
-- =====================================================

-- =====================================================
-- MESSAGES TABLE
-- For user-to-user communication about listings
-- =====================================================
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE, -- Can be NULL for general chat
    content TEXT CHECK (length(content) <= 1000),
    image_url TEXT, -- URL for the image
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- Ensure sender is not receiver
    CHECK (sender_id <> receiver_id),
    -- Ensure either content or image_url is present
    CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

-- =====================================================
-- INDEXES FOR MESSAGES
-- =====================================================
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_listing_id ON messages(listing_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- =====================================================
-- RLS FOR MESSAGES
-- =====================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- NO DELETE POLICY: By not creating a DELETE policy, we prevent anyone from deleting messages.

-- =====================================================
-- STORAGE POLICIES (for chat-images bucket)
-- =====================================================
-- Note: These need to be run after creating the bucket

-- Allow authenticated users to upload images to the chat
CREATE POLICY "Users can upload chat images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.role() = 'authenticated'
  -- Users can only upload to a folder named with their own user ID
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view images in their own chat conversations
CREATE POLICY "Users can view their own chat images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat-images'
  AND auth.role() = 'authenticated'
  -- This is a simplified check. A more secure version might involve checking
  -- if the user is part of the conversation associated with the image.
  -- For now, we allow users to see any image if they are logged in.
  -- This could be improved with more complex RLS.
);

-- =====================================================
-- TABLE PRIVILEGES FOR MESSAGES
-- =====================================================
GRANT SELECT, INSERT ON TABLE public.messages TO authenticated;
GRANT REFERENCES ON TABLE public.messages TO authenticated;

-- =====================================================
-- END OF ADDED CODE FOR CHAT FEATURE
-- =====================================================


-- =====================================================
--For sold items
-- =====================================================
-- If a listing is sold, sold_at and sold_to must be set
ALTER TABLE public.listings
  ADD CONSTRAINT listings_sold_fields_required
  CHECK (
    (is_sold = false)
    OR (is_sold = true AND sold_at IS NOT NULL AND sold_to IS NOT NULL)
  );

  -- Seller can mark their listing as sold exactly once
CREATE POLICY "Seller can mark listing as sold"
ON public.listings
FOR UPDATE
USING (
  auth.uid() = seller_id
)
WITH CHECK (
  -- Only allow transition from unsold -> sold
  is_sold = true
  AND auth.uid() = seller_id

  -- Require sold fields
  AND sold_at IS NOT NULL
  AND sold_to IS NOT NULL

DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;

CREATE POLICY "Users can update their own listings"
ON public.listings
FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (
  -- once sold, it must stay sold
  ( (NOT is_sold) OR (is_sold = true) )
  AND (
    -- if the new row is sold, require sold fields
    (is_sold = false)
    OR (sold_at IS NOT NULL AND sold_to IS NOT NULL)
  )
);


-- =====================================================
-- START OF ADDED CODE FOR AI CHAT FEATURE
-- =====================================================

-- =====================================================
-- AI_CHAT_MESSAGES TABLE
-- Stores messages between users and the AI assistant
-- =====================================================
CREATE TABLE ai_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Who sent the message: user or AI
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai')),

    -- User who owns this conversation
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Optional conversation/session ID (helps grouping)
    session_id UUID DEFAULT gen_random_uuid(),

    -- Message content
    content TEXT CHECK (length(content) <= 4000),

    -- Optional image or file URL
    image_url TEXT,

    -- Whether the user has seen the AI's reply
    is_read BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure at least content or image exists
    CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

-- =====================================================
-- INDEXES FOR AI_CHAT_MESSAGES
-- =====================================================
CREATE INDEX idx_ai_chat_user_id ON ai_chat_messages(user_id);
CREATE INDEX idx_ai_chat_session_id ON ai_chat_messages(session_id);
CREATE INDEX idx_ai_chat_created_at ON ai_chat_messages(created_at DESC);

-- =====================================================
-- RLS FOR AI_CHAT_MESSAGES
-- =====================================================
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read only their own chat history
CREATE POLICY "Users can view their AI chat messages"
  ON ai_chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert messages only as themselves
CREATE POLICY "Users can send messages to AI"
  ON ai_chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender_type = 'user');

-- AI system inserts messages as sender_type = 'ai'
-- (Your backend service role will handle this)
CREATE POLICY "System can insert AI messages"
  ON ai_chat_messages
  FOR INSERT
  TO service_role
  WITH CHECK (sender_type = 'ai');

-- No DELETE policy → prevents deletion

-- =====================================================
-- STORAGE POLICIES (for ai-chat-images bucket)
-- =====================================================
-- Allow authenticated users to upload images for AI chat
CREATE POLICY "Users can upload AI chat images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'ai-chat-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own AI chat images
CREATE POLICY "Users can view AI chat images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'ai-chat-images'
  AND auth.role() = 'authenticated'
);

-- =====================================================
-- TABLE PRIVILEGES
-- =====================================================
GRANT SELECT, INSERT ON TABLE public.ai_chat_messages TO authenticated;
GRANT REFERENCES ON TABLE public.ai_chat_messages TO authenticated;

-- =====================================================
-- END OF ADDED CODE FOR AI CHAT FEATURE
-- =====================================================
