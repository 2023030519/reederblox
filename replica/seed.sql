insert into genres (slug, name) values
 ('accion','Acción'),('aventura','Aventura'),('comedia','Comedia'),('drama','Drama'),('fantasia','Fantasía'),
 ('romance','Romance'),('terror','Terror'),('misterio','Misterio'),('ciencia-ficcion','Ciencia ficción'),
 ('slice-of-life','Slice of life'),('deportes','Deportes'),('historico','Histórico')
on conflict do nothing;