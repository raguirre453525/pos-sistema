
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'MiSistemaPOS')
    CREATE DATABASE MiSistemaPOS;
GO

USE MiSistemaPOS;
GO

IF OBJECT_ID('Roles', 'U') IS NULL
BEGIN
    CREATE TABLE Roles (
        Id INT IDENTITY(1,1) NOT NULL,
        Name VARCHAR(100) NOT NULL,
        Description VARCHAR(255) NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT PK_Roles PRIMARY KEY (Id),
        CONSTRAINT UQ_Roles_Name UNIQUE (Name)
    );
END
GO

IF OBJECT_ID('Users', 'U') IS NULL
BEGIN
    CREATE TABLE Users (
        Id INT IDENTITY(1,1) NOT NULL,
        Username VARCHAR(50) NOT NULL,
        PasswordHash VARCHAR(255) NOT NULL,
        RoleId INT NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT PK_Users PRIMARY KEY (Id),
        CONSTRAINT UQ_Users_Username UNIQUE (Username),
        CONSTRAINT FK_Users_RoleId FOREIGN KEY (RoleId) REFERENCES Roles(Id)
    );
END
GO

IF OBJECT_ID('Categories', 'U') IS NULL
BEGIN
    CREATE TABLE Categories (
        Id INT IDENTITY(1,1) NOT NULL,
        Name VARCHAR(100) NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT PK_Categories PRIMARY KEY (Id),
        CONSTRAINT UQ_Categories_Name UNIQUE (Name)
    );
END
GO

IF OBJECT_ID('Products', 'U') IS NULL
BEGIN
    CREATE TABLE Products (
        Id INT IDENTITY(1,1) NOT NULL,
        Name VARCHAR(100) NOT NULL,
        Price DECIMAL(10,2) NOT NULL,
        CategoryId INT NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT PK_Products PRIMARY KEY (Id),
        CONSTRAINT FK_Products_CategoryId FOREIGN KEY (CategoryId) REFERENCES Categories(Id),
        CONSTRAINT CK_Products_price CHECK (Price >= 0)
    );
END
GO