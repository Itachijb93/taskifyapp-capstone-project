/* ================================
   1. Create database if needed
   ================================ */
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'taskify_db')
BEGIN
    CREATE DATABASE taskify_db;
END;
GO

USE taskify_db;
GO

/* ================================
   2. Drop old trigger and table
   ================================ */
IF EXISTS (SELECT * FROM sys.triggers WHERE name = N'trg_tasks_update_timestamp')
BEGIN
    DROP TRIGGER trg_tasks_update_timestamp;
END;
GO

IF OBJECT_ID('dbo.tasks', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.tasks;
END;
GO

/* ================================
   3. Create tasks table
   ================================ */
CREATE TABLE dbo.tasks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(255) NOT NULL,
    finished BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL
);
GO

/* ================================
   4. Trigger to maintain updated_at
   ================================ */
CREATE TRIGGER trg_tasks_update_timestamp
ON dbo.tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE t
    SET updated_at = SYSDATETIME()
    FROM dbo.tasks AS t
    INNER JOIN inserted AS i
        ON t.id = i.id;
END;
GO

/* ================================
   5. Seed sample data
   ================================ */
INSERT INTO dbo.tasks (title, finished) VALUES
(N'Complete React frontend', 0),
(N'Set up MSSQL database', 1),
(N'Wire up Express API', 0),
(N'Add Docker support', 0),
(N'Test CRUD operations', 0);
GO

/* ================================
   6. Quick checks
   ================================ */
SELECT COUNT(*) AS tasks FROM dbo.tasks;
SELECT TOP 5 * FROM dbo.tasks ORDER BY id DESC;
GO
