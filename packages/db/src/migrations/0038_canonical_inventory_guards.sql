-- Phase 3 safety boundary: owner inventory must never point at another
-- owner's product variant, and structured B2B lines must retain canonical
-- source/target identity.

CREATE OR REPLACE FUNCTION assert_inventory_variant_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  variant_creator product_creator_source;
  variant_owner text;
BEGIN
  SELECT
    p.creator_source,
    COALESCE(p.created_by_id, p.created_by_warehouse_id)
  INTO variant_creator, variant_owner
  FROM product_variant pv
  JOIN product p ON p.id = pv.product_id
  WHERE pv.id = NEW.variant_id;

  IF variant_creator IS NULL THEN
    RAISE EXCEPTION 'Inventory variant % has no product owner', NEW.variant_id;
  END IF;

  IF NEW.owner_type = 'shop'
     AND (variant_creator <> 'shop' OR variant_owner IS DISTINCT FROM NEW.owner_id) THEN
    RAISE EXCEPTION
      'Shop inventory owner % cannot reference % variant % owned by %',
      NEW.owner_id, variant_creator, NEW.variant_id, variant_owner;
  END IF;

  IF NEW.owner_type = 'warehouse'
     AND (variant_creator <> 'warehouse' OR variant_owner IS DISTINCT FROM NEW.owner_id) THEN
    RAISE EXCEPTION
      'Warehouse inventory owner % cannot reference % variant % owned by %',
      NEW.owner_id, variant_creator, NEW.variant_id, variant_owner;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_variant_owner_guard ON inventory;
CREATE TRIGGER inventory_variant_owner_guard
BEFORE INSERT OR UPDATE OF owner_type, owner_id, variant_id
ON inventory
FOR EACH ROW
EXECUTE FUNCTION assert_inventory_variant_owner();

CREATE OR REPLACE FUNCTION assert_b2b_order_item_catalog_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_order_type b2b_order_type;
  source_option_id integer;
  source_catalog_id integer;
  target_catalog_id integer;
  allowed_conversion_target_id integer;
BEGIN
  SELECT o.order_type INTO current_order_type
  FROM "order" o
  WHERE o.id = NEW.order_id;

  IF current_order_type IS DISTINCT FROM 'b2b' OR NEW.variant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pv.source_variant_option_id, pv.catalog_variant_id
  INTO source_option_id, source_catalog_id
  FROM product_variant pv
  WHERE pv.id = NEW.variant_id;

  -- Legacy unstructured lines remain compatible. Every structured B2B line
  -- created after this migration must carry the canonical source identity.
  IF source_option_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF source_catalog_id IS NULL
     OR NEW.catalog_variant_id IS NULL
     OR NEW.catalog_variant_id IS DISTINCT FROM source_catalog_id THEN
    RAISE EXCEPTION
      'Structured B2B order item must match source catalog variant (source %, supplied %)',
      source_catalog_id, NEW.catalog_variant_id;
  END IF;

  IF NEW.target_variant_id IS NOT NULL THEN
    SELECT pv.catalog_variant_id INTO target_catalog_id
    FROM product_variant pv
    WHERE pv.id = NEW.target_variant_id;

    SELECT cv.conversion_target_catalog_variant_id
    INTO allowed_conversion_target_id
    FROM catalog_variant cv
    WHERE cv.id = source_catalog_id;

    IF target_catalog_id IS NULL OR (
      target_catalog_id IS DISTINCT FROM source_catalog_id
      AND target_catalog_id IS DISTINCT FROM allowed_conversion_target_id
    ) THEN
      RAISE EXCEPTION
        'B2B target catalog variant % is incompatible with source %',
        target_catalog_id, source_catalog_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b2b_order_item_catalog_identity_guard ON order_item;
CREATE TRIGGER b2b_order_item_catalog_identity_guard
BEFORE INSERT OR UPDATE OF order_id, variant_id, target_variant_id, catalog_variant_id
ON order_item
FOR EACH ROW
EXECUTE FUNCTION assert_b2b_order_item_catalog_identity();
