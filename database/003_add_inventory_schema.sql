USE MiSistemaPOS;
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Products'
      AND COLUMN_NAME = 'SKU'
)
BEGIN
    ALTER TABLE Products
        ADD SKU VARCHAR(50) NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE OBJECT_ID = OBJECT_ID('Products')
      AND name = 'UQ_Products_SKU'
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_Products_SKU
        ON Products (SKU);
END
GO

IF OBJECT_ID('InventoryLogs', 'U') IS NULL
BEGIN
    CREATE TABLE InventoryLogs (
        Id INT IDENTITY(1,1) NOT NULL,
        ProductId INT NOT NULL,
        QuantityChange INT NOT NULL,
        MovementType VARCHAR(20) NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT PK_InventoryLogs PRIMARY KEY (Id),
        CONSTRAINT FK_InventoryLogs_ProductId FOREIGN KEY (ProductId) REFERENCES Products(Id)
    );
END
GO