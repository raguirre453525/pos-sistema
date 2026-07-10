
USE MiSistemaPOS;
GO

IF NOT EXISTS (SELECT 1 FROM [Categories] WHERE [Name] = 'Electrónica')
BEGIN
    INSERT INTO [Categories] ([Name], [IsActive], [CreatedAt])
    VALUES ('Electrónica', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Categories] WHERE [Name] = 'Ropa')
BEGIN
    INSERT INTO [Categories] ([Name], [IsActive], [CreatedAt])
    VALUES ('Ropa', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Categories] WHERE [Name] = 'Alimentos')
BEGIN
    INSERT INTO [Categories] ([Name], [IsActive], [CreatedAt])
    VALUES ('Alimentos', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Categories] WHERE [Name] = 'Hogar')
BEGIN
    INSERT INTO [Categories] ([Name], [IsActive], [CreatedAt])
    VALUES ('Hogar', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Categories] WHERE [Name] = 'Deportes')
BEGIN
    INSERT INTO [Categories] ([Name], [IsActive], [CreatedAt])
    VALUES ('Deportes', 1, GETDATE());
END
GO


IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ELEC-001')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Auriculares Bluetooth', 14999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Electrónica'), 'ELEC-001', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ELEC-002')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Cargador USB-C 65W', 8999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Electrónica'), 'ELEC-002', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ELEC-003')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Teclado Mecánico RGB', 25999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Electrónica'), 'ELEC-003', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ELEC-004')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Mouse Inalámbrico', 12499.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Electrónica'), 'ELEC-004', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ROPA-001')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Camiseta Algodón M/L', 5999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Ropa'), 'ROPA-001', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ROPA-002')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Jean Clásico', 18999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Ropa'), 'ROPA-002', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ROPA-003')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Chaqueta Impermeable', 34999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Ropa'), 'ROPA-003', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ROPA-004')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Zapatillas Deportivas', 42999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Ropa'), 'ROPA-004', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ALIM-001')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Café Molido 500g', 8499.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Alimentos'), 'ALIM-001', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ALIM-002')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Aceite Oliva Extra 1L', 12999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Alimentos'), 'ALIM-002', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ALIM-003')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Arroz Integral 1kg', 3999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Alimentos'), 'ALIM-003', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'ALIM-004')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Chocolate Amargo 70%', 5499.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Alimentos'), 'ALIM-004', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'HOGA-001')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Lámpara LED Escritorio', 15999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Hogar'), 'HOGA-001', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'HOGA-002')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Set Sartenes Antiadherentes', 27999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Hogar'), 'HOGA-002', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'HOGA-003')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Organizador Modular 6U', 11999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Hogar'), 'HOGA-003', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'HOGA-004')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Cortina Blackout 140cm', 21999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Hogar'), 'HOGA-004', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'DEPO-001')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Colchoneta Yoga 10mm', 9999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Deportes'), 'DEPO-001', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'DEPO-002')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Juego Pesas 2x5kg', 19999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Deportes'), 'DEPO-002', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'DEPO-003')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Cuerda Saltar Ajustable', 6499.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Deportes'), 'DEPO-003', 1, GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM [Products] WHERE [SKU] = 'DEPO-004')
BEGIN
    INSERT INTO [Products] ([Name], [Price], [CategoryId], [SKU], [IsActive], [CreatedAt])
    VALUES ('Botella Deportiva 750ml', 4999.99, (SELECT [Id] FROM [Categories] WHERE [Name] = 'Deportes'), 'DEPO-004', 1, GETDATE());
END
GO


GO
