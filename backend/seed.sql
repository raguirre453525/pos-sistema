-- seed.sql - Limpieza y siembra catálogo realista El Chorolqui (kiosco/almacén argentino)
-- Ejecutar: sqlcmd -S "(localdb)\mssqllocaldb" -d MetraTC_DB -i backend\seed.sql
-- NOTA: Preserva ventas/clientes (FK Restrict en SaleItems). Productos con ventas se desactivan (IsActive=0) y quedan ocultos por QueryFilter.

SET QUOTED_IDENTIFIER ON;
GO

PRINT '=== LIMPIEZA ===';

-- Orden FK: primero tablas dependientes con CASCADE/Restrict
DELETE FROM ProductPriceHistories;
PRINT 'ProductPriceHistories limpiadas';

DELETE FROM StockAdjustmentAudits;
PRINT 'StockAdjustmentAudits limpiadas';

DELETE FROM PromotionProductLines;
PRINT 'PromotionProductLines limpiadas';

-- SalePromotions no bloquea Products pero se limpia si hay test
DELETE FROM SalePromotions;
PRINT 'SalePromotions limpiadas';

DELETE FROM ProductCategories;
PRINT 'ProductCategories limpiadas';

-- Productos: los que tienen ventas no se pueden borrar (FK NO_ACTION). Se desactivan y quedan ocultos.
-- Después se borran los que no tienen ventas.
DECLARE @deactivated int, @deleted int;
UPDATE Products SET IsActive = 0 WHERE Id IN (SELECT ProductId FROM SaleItems);
SET @deactivated = @@ROWCOUNT;
PRINT CONCAT('Productos con ventas desactivados (IsActive=0): ', @deactivated);

DELETE FROM Products WHERE Id NOT IN (SELECT ProductId FROM SaleItems);
SET @deleted = @@ROWCOUNT;
PRINT CONCAT('Productos sin ventas borrados físicamente: ', @deleted);

-- Categorías: ya sin ProductCategories, se pueden borrar. Necesita QUOTED_IDENTIFIER ON por índice filtrado.
DELETE FROM Categories;
PRINT 'Categories limpiadas';

SELECT COUNT(*) AS ProductosActivos_Restantes FROM Products WHERE IsActive = 1;
SELECT COUNT(*) AS ProductosTotales_Restantes FROM Products;
SELECT COUNT(*) AS CategoriasRestantes FROM Categories;
GO

PRINT '=== SIEMBRA CATEGORIAS (6) ===';

DECLARE @catBebidas uniqueidentifier = NEWID();
DECLARE @catAlmacen uniqueidentifier = NEWID();
DECLARE @catSnacks uniqueidentifier = NEWID();
DECLARE @catLacteos uniqueidentifier = NEWID();
DECLARE @catLimpieza uniqueidentifier = NEWID();
DECLARE @catKiosco uniqueidentifier = NEWID();

INSERT INTO Categories (Id, Name, Description, IsActive, CreatedAt) VALUES
(@catBebidas,  N'Bebidas',             N'Gaseosas, jugos, aguas y cervezas', 1, GETUTCDATE()),
(@catAlmacen,  N'Almacén',             N'Yerba, azúcar, fideos, arroz, aceite, harina', 1, GETUTCDATE()),
(@catSnacks,   N'Snacks & Golosinas',  N'Papas, alfajores, galletitas, chocolates', 1, GETUTCDATE()),
(@catLacteos,  N'Lácteos',             N'Leche, yogur, quesos, dulce de leche', 1, GETUTCDATE()),
(@catLimpieza, N'Limpieza',            N'Lavandina, detergente, jabón, rollos', 1, GETUTCDATE()),
(@catKiosco,   N'Kiosco',              N'Vinos, fernet y cervezas artesanales', 1, GETUTCDATE());

SELECT Name, Id FROM Categories;
GO

-- Guardar IDs de categorías en tabla temp para el siguiente batch (variables no persisten entre GO)
-- Re-obtener IDs por nombre
PRINT '=== SIEMBRA PRODUCTOS (27) ===';

-- Insertar productos con FK N:M vía ProductCategories después
-- Product columns: Id, Sku, Barcode, Name, Description, Price, IsActive, CreatedAt, Stock, ImageUrl, MinStock, Unit

DECLARE @catBebidas uniqueidentifier = (SELECT Id FROM Categories WHERE Name = N'Bebidas');
DECLARE @catAlmacen uniqueidentifier = (SELECT Id FROM Categories WHERE Name = N'Almacén');
DECLARE @catSnacks uniqueidentifier = (SELECT Id FROM Categories WHERE Name = N'Snacks & Golosinas');
DECLARE @catLacteos uniqueidentifier = (SELECT Id FROM Categories WHERE Name = N'Lácteos');
DECLARE @catLimpieza uniqueidentifier = (SELECT Id FROM Categories WHERE Name = N'Limpieza');
DECLARE @catKiosco uniqueidentifier = (SELECT Id FROM Categories WHERE Name = N'Kiosco');

-- Para productos necesitamos IDs estables para luego mapear a categorías
DECLARE @p1 uniqueidentifier = NEWID(); -- Coca
DECLARE @p2 uniqueidentifier = NEWID(); -- Pepsi
DECLARE @p3 uniqueidentifier = NEWID(); -- Seven Up
DECLARE @p4 uniqueidentifier = NEWID(); -- Cepita
DECLARE @p5 uniqueidentifier = NEWID(); -- Villavicencio
DECLARE @p6 uniqueidentifier = NEWID(); -- Quilmes
DECLARE @p7 uniqueidentifier = NEWID(); -- Playadito
DECLARE @p8 uniqueidentifier = NEWID(); -- Ledesma
DECLARE @p9 uniqueidentifier = NEWID(); -- Matarazzo
DECLARE @p10 uniqueidentifier = NEWID();-- Gallo Oro
DECLARE @p11 uniqueidentifier = NEWID();-- Natura
DECLARE @p12 uniqueidentifier = NEWID();-- Blancaflor
DECLARE @p13 uniqueidentifier = NEWID();-- Lays
DECLARE @p14 uniqueidentifier = NEWID();-- Jorgito
DECLARE @p15 uniqueidentifier = NEWID();-- Oreo
DECLARE @p16 uniqueidentifier = NEWID();-- Cofler
DECLARE @p17 uniqueidentifier = NEWID();-- Turron
DECLARE @p18 uniqueidentifier = NEWID();-- Leche Serenisima
DECLARE @p19 uniqueidentifier = NEWID();-- Yogur Ser
DECLARE @p20 uniqueidentifier = NEWID();-- Queso Cremoso
DECLARE @p21 uniqueidentifier = NEWID();-- DDL
DECLARE @p22 uniqueidentifier = NEWID();-- Ayudin
DECLARE @p23 uniqueidentifier = NEWID();-- Magistral
DECLARE @p24 uniqueidentifier = NEWID();-- Ala
DECLARE @p25 uniqueidentifier = NEWID();-- Sussex
DECLARE @p26 uniqueidentifier = NEWID();-- Vino Toro
DECLARE @p27 uniqueidentifier = NEWID();-- Fernet

INSERT INTO Products (Id, Sku, Barcode, Name, Description, Price, IsActive, CreatedAt, Stock, ImageUrl, MinStock, Unit) VALUES
(@p1,  N'COCA-1500',          N'7790895000996', N'Coca Cola 1.5L',                 N'Gaseosa Coca Cola 1.5L', 2800.00, 1, GETUTCDATE(), 24.000, NULL, 5.000, N'un'),
(@p2,  N'PEPSI-1500',         N'7792798000157', N'Pepsi 1.5L',                     N'Gaseosa Pepsi 1.5L', 2700.00, 1, GETUTCDATE(), 18.000, NULL, 5.000, N'un'),
(@p3,  N'SEVEN-1500',         N'7792798000225', N'Seven Up 1.5L',                  N'Gaseosa Seven Up 1.5L', 2700.00, 1, GETUTCDATE(), 15.000, NULL, 5.000, N'un'),
(@p4,  N'CEPITA-NAR-1000',    N'7790895001238', N'Jugo Cepita Naranja 1L',         N'Jugo Cepita Naranja 1L', 2200.00, 1, GETUTCDATE(), 3.000, NULL, 5.000, N'un'),
(@p5,  N'VILLA-500',          N'7790240001234', N'Agua Villavicencio 500ml',       N'Agua mineral Villavicencio 500ml', 1500.00, 1, GETUTCDATE(), 32.000, NULL, 5.000, N'un'),
(@p6,  N'QUILMES-1000',       N'7792798000331', N'Cerveza Quilmes 1L',             N'Cerveza Quilmes Clásica 1L', 3200.00, 1, GETUTCDATE(), 20.000, NULL, 5.000, N'un'),
(@p7,  N'YERBA-PLAYA-1000',   N'7790387000123', N'Yerba Playadito 1kg',            N'Yerba mate Playadito 1kg', 5200.00, 1, GETUTCDATE(), 45.000, NULL, 5.000, N'un'),
(@p8,  N'AZUCAR-LEDESMA-1000',N'7790740000011', N'Azúcar Ledesma 1kg',            N'Azúcar blanca Ledesma 1kg', 1800.00, 1, GETUTCDATE(), 2.000, NULL, 5.000, N'un'),
(@p9,  N'FIDEOS-MATAR-500',   N'7790070001015', N'Fideos Matarazzo 500g',          N'Fideos tallarín Matarazzo 500g', 1900.00, 1, GETUTCDATE(), 28.000, NULL, 5.000, N'un'),
(@p10, N'ARROZ-GALLO-1000',   N'7790070002029', N'Arroz Gallo Oro 1kg',            N'Arroz largo fino Gallo Oro 1kg', 2800.00, 1, GETUTCDATE(), 19.000, NULL, 5.000, N'un'),
(@p11, N'ACEITE-NATURA-900',  N'7790070003033', N'Aceite Natura 900ml',            N'Aceite girasol Natura 900ml', 4200.00, 1, GETUTCDATE(), 12.000, NULL, 5.000, N'un'),
(@p12, N'HARINA-BLANCA-1000', N'7790070004047', N'Harina 000 Blancaflor 1kg',      N'Harina 000 Blancaflor 1kg', 1700.00, 1, GETUTCDATE(), 4.000, NULL, 5.000, N'un'),
(@p13, N'LAYS-90',            N'7790310001011', N'Papas Lays 90g',                 N'Papas fritas Lays clásicas 90g', 2800.00, 1, GETUTCDATE(), 35.000, NULL, 5.000, N'un'),
(@p14, N'ALFA-JORGITO',       N'7795150000111', N'Alfajor Jorgito',                N'Alfajor Jorgito chocolate negro', 900.00, 1, GETUTCDATE(), 50.000, NULL, 5.000, N'un'),
(@p15, N'OREO-118',           N'7622210441234', N'Galletitas Oreo 118g',           N'Galletitas Oreo 118g', 2100.00, 1, GETUTCDATE(), 22.000, NULL, 5.000, N'un'),
(@p16, N'COFLER-CHOC',        N'7790040001234', N'Chocolatín Cofler',              N'Chocolate Cofler 38g', 1100.00, 1, GETUTCDATE(), 3.000, NULL, 5.000, N'un'),
(@p17, N'TURRON-ARCOR',       N'7790040002345', N'Turrón Arcor',                   N'Turrón de maní Arcor', 800.00, 1, GETUTCDATE(), 40.000, NULL, 5.000, N'un'),
(@p18, N'LECHE-SEREN-1000',   N'7790740002022', N'Leche La Serenísima 1L',        N'Leche entera La Serenísima 1L', 2100.00, 1, GETUTCDATE(), 18.000, NULL, 5.000, N'un'),
(@p19, N'YOGUR-SER-160',      N'7790740003036', N'Yogur Ser 160g',                 N'Yogur Ser sabor frutilla 160g', 1300.00, 1, GETUTCDATE(), 8.000, NULL, 5.000, N'un'),
(@p20, N'QUESO-CREM-1000',     N'7790740004040', N'Queso Cremoso 1kg',              N'Queso cremoso granel 1kg (venta por peso)', 8500.00, 1, GETUTCDATE(), 12.500, NULL, 5.000, N'kg'),
(@p21, N'DDL-SEREN-400',      N'7790740005054', N'Dulce de Leche La Serenísima 400g', N'Dulce de leche La Serenísima 400g', 3200.00, 1, GETUTCDATE(), 15.000, NULL, 5.000, N'un'),
(@p22, N'AYUDIN-1L',          N'7790550001011', N'Lavandina Ayudín 1L',           N'Lavandina Ayudín 1L', 1800.00, 1, GETUTCDATE(), 30.000, NULL, 5.000, N'un'),
(@p23, N'MAGISTRAL-500',      N'7790550002025', N'Detergente Magistral 500ml',     N'Detergente Magistral 500ml', 2400.00, 1, GETUTCDATE(), 2.000, NULL, 5.000, N'un'),
(@p24, N'ALA-800',            N'7790550003039', N'Jabón Ala 800g',                N'Jabón en polvo Ala 800g', 2600.00, 1, GETUTCDATE(), 14.000, NULL, 5.000, N'un'),
(@p25, N'SUSSEX-ROLL',        N'7790550004043', N'Rollo Cocina Sussex',            N'Rollo de cocina Sussex 100 paños', 1900.00, 1, GETUTCDATE(), 25.000, NULL, 5.000, N'un'),
(@p26, N'VINO-TORO-1000',     N'7790240100123', N'Vino Toro Tinto 1L',             N'Vino Toro tinto 1L', 3500.00, 1, GETUTCDATE(), 10.000, NULL, 5.000, N'un'),
(@p27, N'FERNET-BRANCA-750',  N'7790240200234', N'Fernet Branca 750ml',            N'Fernet Branca 750ml', 7800.00, 1, GETUTCDATE(), 8.000, NULL, 5.000, N'un');

-- Mapeo N:M ProductCategories (CategoriesId, ProductsId)
INSERT INTO ProductCategories (CategoriesId, ProductsId) VALUES
(@catBebidas, @p1), (@catBebidas, @p2), (@catBebidas, @p3), (@catBebidas, @p4), (@catBebidas, @p5), (@catBebidas, @p6),
(@catAlmacen, @p7), (@catAlmacen, @p8), (@catAlmacen, @p9), (@catAlmacen, @p10), (@catAlmacen, @p11), (@catAlmacen, @p12),
(@catSnacks, @p13), (@catSnacks, @p14), (@catSnacks, @p15), (@catSnacks, @p16), (@catSnacks, @p17),
(@catLacteos, @p18), (@catLacteos, @p19), (@catLacteos, @p20), (@catLacteos, @p21),
(@catLimpieza, @p22), (@catLimpieza, @p23), (@catLimpieza, @p24), (@catLimpieza, @p25),
(@catKiosco, @p26), (@catKiosco, @p27);

PRINT 'Productos insertados: 27';
PRINT 'ProductCategories insertadas: 27';

-- Verificación distribución
SELECT c.Name AS Categoria, COUNT(pc.ProductsId) AS Productos
FROM Categories c
LEFT JOIN ProductCategories pc ON pc.CategoriesId = c.Id
GROUP BY c.Name
ORDER BY c.Name;

SELECT p.Sku, p.Name, p.Price, p.Stock, p.MinStock, p.Unit,
       STRING_AGG(c.Name, ', ') AS Categorias
FROM Products p
LEFT JOIN ProductCategories pc ON pc.ProductsId = p.Id
LEFT JOIN Categories c ON c.Id = pc.CategoriesId
WHERE p.IsActive = 1
GROUP BY p.Sku, p.Name, p.Price, p.Stock, p.MinStock, p.Unit
ORDER BY Categorias, p.Name;

-- Stock bajo (para probar notificaciones)
SELECT Name, Stock, MinStock FROM Products WHERE IsActive=1 AND Stock <= MinStock ORDER BY Stock;

SELECT COUNT(*) AS ProductosActivos FROM Products WHERE IsActive=1;
SELECT COUNT(*) AS CategoriasActivas FROM Categories WHERE IsActive=1;
GO
