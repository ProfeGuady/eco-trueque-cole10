-- Eco-Trueque Escolar - Colegio N° 10
-- PARTE 2: reglas de seguridad (RLS) y funciones.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de crear las tablas (ver db.js).

-- 1) Catálogo: cualquiera puede ver y donar.
--    Nadie puede editar ni borrar artículos desde la app.
create policy "ver catalogo" on items_donados
  for select to anon
  using (true);

create policy "donar" on items_donados
  for insert to anon
  with check (
    categoria in ('uniforme', 'utiles', 'alimentos')
    and stock between 1 and 1000
    and entregados = 0
    and length(nombre) between 1 and 200
  );

-- 2) Colectas: cualquiera puede verlas y crear una nueva (siempre desde cero).
create policy "ver colectas" on delegados_curso
  for select to anon
  using (true);

create policy "crear colecta" on delegados_curso
  for insert to anon
  with check (
    actual_unidades = 0
    and meta_unidades between 1 and 100000
  );

-- 3) Solicitudes: SIN reglas para anon. Nadie puede leerlas ni modificarlas
--    desde la app. Solo se cargan con la función registrar_solicitud.
--    La docente las ve en Supabase > Table Editor.

-- 4) Función: registra un pedido y descuenta el stock en un solo paso.
create or replace function registrar_solicitud(
  p_item_id bigint,
  p_item_nombre text,
  p_tipo text,
  p_usuario_interno text,
  p_curso text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_item_id is not null then
    update items_donados
       set stock = stock - 1,
           entregados = entregados + 1
     where id = p_item_id
       and stock > 0;
  end if;

  insert into solicitudes_anonimas (item_id, item_nombre, tipo, usuario_interno, curso)
  values (
    p_item_id,
    left(p_item_nombre, 200),
    coalesce(p_tipo, 'catalogo'),
    left(p_usuario_interno, 100),
    left(p_curso, 50)
  );
end;
$$;

-- 5) Función: suma un aporte a una colecta de alimentos.
create or replace function sumar_aporte(p_id bigint, p_cantidad int)
returns void
language sql
security definer
set search_path = public
as $$
  update delegados_curso
     set actual_unidades = actual_unidades
         + greatest(1, least(coalesce(p_cantidad, 1), 1000))
   where id = p_id;
$$;

grant execute on function registrar_solicitud(bigint, text, text, text, text) to anon;
grant execute on function sumar_aporte(bigint, int) to anon;
