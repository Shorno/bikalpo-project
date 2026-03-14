-- PostgreSQL Migration Script for Unified Offer System
-- This migration converts the offer table to support multiple offer types with products lists
-- Run this migration to add new columns to the offer table

-- Add new columns to offer table
ALTER TABLE offer ADD COLUMN type VARCHAR(100) DEFAULT 'Weekly Offers' NOT NULL;
ALTER TABLE offer ADD COLUMN original_price INTEGER;
ALTER TABLE offer ADD COLUMN combo_price INTEGER;
ALTER TABLE offer ADD COLUMN banner_image TEXT;
ALTER TABLE offer ADD COLUMN products TEXT;

-- Create index on type for faster filtering by offer type
CREATE INDEX idx_offer_type ON offer(type);
CREATE INDEX idx_offer_active_type ON offer(active, type);

-- Migration notes:
-- - type: VARCHAR(100) stores the offer type (Weekly Offers, Combo Deals, Brand Campaigns, More Offers)
-- - original_price: INTEGER stores the original price in cents
-- - combo_price: INTEGER stores the final combo price in cents
-- - banner_image: TEXT stores the Cloudinary URL for the offer banner
-- - products: TEXT stores JSON array of product names/IDs like ["Product 1", "Product 2"]
-- 
-- Backward compatibility:
-- - imageUrl column is preserved for legacy support without renaming
-- - targetProducts column is preserved for legacy support
-- - discount_percentage is renamed/used as the discount value
--
-- Example products JSON:
-- ["Potato Chips", "Energy Biscuit", "Apple Juice"]
--
-- After migration, the offer table structure will be:
-- id (serial, primary key)
-- title (varchar)
-- description (text)
-- type (varchar) - NEW: Weekly Offers, Combo Deals, Brand Campaigns, More Offers
-- discount_percentage (integer)
-- original_price (integer) - NEW: Original price before combo
-- combo_price (integer) - NEW: Final combo price
-- banner_image (text) - NEW: Cloudinary image URL
-- products (text) - NEW: JSON array of product names
-- target_products (text) - LEGACY: Kept for backward compatibility
-- image_url (text) - LEGACY: Kept for backward compatibility
-- active (boolean)
-- start_date (varchar)
-- end_date (varchar)
-- priority (integer)
-- badge (varchar)
-- created_at (timestamp)
-- updated_at (timestamp)
