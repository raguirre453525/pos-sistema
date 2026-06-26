CREATE TABLE Roles (
    Id INT IDENTITY(1,1) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    CONSTRAINT PK_Roles PRIMARY KEY (Id),
    CONSTRAINT UQ_Roles_name UNIQUE (name)
);

CREATE TABLE Users (
    Id INT IDENTITY(1,1) NOT NULL,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY (Id),
    CONSTRAINT UQ_Users_username UNIQUE (username),
    CONSTRAINT FK_Users_role_id FOREIGN KEY (role_id) REFERENCES Roles(Id)
);
