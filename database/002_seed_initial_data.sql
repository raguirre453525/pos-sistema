USE MiSistemaPOS;
GO
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Administrador')
    INSERT INTO Roles (Name, Description) VALUES ('Administrador', 'Acceso total al sistema');

IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Cajero')
    INSERT INTO Roles (Name, Description) VALUES ('Cajero', 'Acceso limitado a ventas');

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'Admin')
BEGIN
    INSERT INTO Users (Username, PasswordHash, RoleId)
    VALUES ('Admin', 
            '$2a$11$K4YfGqJ1e4YHIp5q3Y5q3e5Y3q5Y3q5Y3q5Y3q5Y3q5Y3q5Y3q', 
            (SELECT Id FROM Roles WHERE Name = 'Administrador'));
END
GO