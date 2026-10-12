-- Applied as 20261012021443 on the production project.
-- Editable media metadata is not an authority for storage ownership.
CREATE OR REPLACE FUNCTION public.spark_can_access_storage_path(object_path TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT public.is_admin((select auth.uid())) OR EXISTS (
   SELECT 1 FROM public.brands b WHERE b.owner_id = (select auth.uid()) AND
    (b.id::text = CASE WHEN split_part(object_path,'/',1)='brands'
       THEN split_part(object_path,'/',2) ELSE split_part(object_path,'/',1) END
     OR (split_part(object_path,'/',1)<>'brands' AND EXISTS (
       SELECT 1 FROM public.productions p
       WHERE p.brand_id=b.id AND p.id::text=split_part(object_path,'/',1))))
 );
$$;
REVOKE ALL ON FUNCTION public.spark_can_access_storage_path(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spark_can_access_storage_path(TEXT) TO authenticated, service_role;
