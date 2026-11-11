-- Eco-Trueque Escolar - Colegio N° 10
-- OPCIONAL: carga artículos y colectas de ejemplo, con los contadores en cero.
-- Se pueden editar o borrar después desde Supabase > Table Editor.

insert into items_donados (categoria, nombre, talle_detalle, stock, entregados, peso_unit_kg) values
  ('uniforme', 'Remera de uniforme Colegio N° 10', 'Talle M (excelente estado)', 6, 0, 0.22),
  ('uniforme', 'Pantalón jogging escolar verde/gris', 'Talles S y L', 4, 0, 0.45),
  ('uniforme', 'Buzo abrigo uniforme', 'Talle L', 3, 0, 0.55),
  ('utiles', 'Cuadernos tapa dura 48 hojas', 'Rayados y cuadriculados', 12, 0, 0.30),
  ('utiles', 'Kit de biromes, lápices y goma', 'Set x 4 unidades', 15, 0, 0.08),
  ('utiles', 'Regla, escuadra y transportador (Geometría)', 'Donado por profes de Matemática', 8, 0, 0.12);

insert into delegados_curso (curso, generacion_legado, campania_alimento, meta_unidades, actual_unidades) values
  ('5° Año (Fundadores) + 4° Año (Herederos)', 'Posta Solidaria 5° -> 4°', 'Fideos secos (paquetes 500g)', 80, 0),
  ('Comunidad 1° a 5° Año', 'Colecta Mensual', 'Arroz largo fino (paquetes 1kg)', 60, 0),
  ('Equipo Docente y Preceptoría', 'Refuerzo Merienda / Despensa', 'Leche larga vida / Lentejas / Puré de tomate', 50, 0);
