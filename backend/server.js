require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MSSQL connection pool - Windows Authentication
let dbPool = null;

async function getDbPool() {
  if (!dbPool) {
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER || 'localhost',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      database: process.env.DB_DATABASE || 'taskify_db',
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };

    console.log('🔍 Connecting with:', {
      server: config.server,
      port: config.port,
      user: config.user,
      database: config.database
    });

    dbPool = await sql.connect(config);
    console.log('✅ MSSQL Database connected (SQL login)!');
  }
  return dbPool;
}



async function query(sqlQuery, params = {}) {
  const pool = await getDbPool();
  try {
    const request = pool.request();
    
    // Add parameters safely
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
    
    const result = await request.query(sqlQuery);
    return result;
  } catch (err) {
    console.error('SQL error:', err.message);
    throw err;
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1 as connected');
    res.json({ 
      status: 'OK', 
      message: 'Database connected successfully!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed', 
      details: error.message 
    });
  }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await query('SELECT * FROM dbo.tasks ORDER BY id DESC');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching tasks:', error.message);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Add new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || title.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Task title must be at least 3 characters' 
      });
    }
    
    const insertSQL = 'INSERT INTO dbo.tasks (title, finished) OUTPUT INSERTED.* VALUES (@title, 0)';
    const result = await query(insertSQL, { title: title.trim() });
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating task:', error.message);
    res.status(500).json({ error: 'Failed to create task' });
  }
});



app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, finished } = req.body;
    const taskId = parseInt(id, 10);

    if (Number.isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    // 1) Update without OUTPUT (trigger will handle updated_at)
    const updateSQL = `
      UPDATE dbo.tasks
      SET 
        title = COALESCE(@title, title),
        finished = COALESCE(@finished, finished),
        updated_at = SYSDATETIME()
      WHERE id = @id;
    `;

    await query(updateSQL, {
      id: taskId,
      title: title ?? null,
      finished: finished ?? null
    });

    // 2) Fetch the updated row
    const selectSQL = `
      SELECT *
      FROM dbo.tasks
      WHERE id = @id;
    `;
    const result = await query(selectSQL, { id: taskId });

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating task:', error.message);
    res.status(500).json({ error: 'Failed to update task' });
  }
});


// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleteSQL = 'DELETE FROM dbo.tasks WHERE id = @id';
    const result = await query(deleteSQL, { id: parseInt(id) });
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error.message);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (dbPool) {
    try {
      await dbPool.close();
      console.log('✅ Database pool closed');
    } catch (error) {
      console.error('Error closing pool:', error.message);
    }
  }
  process.exit(0);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Taskify Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📋 Tasks API: http://localhost:${PORT}/api/tasks`);
  console.log(`🛠️  Press Ctrl+C to shutdown gracefully`);
});
