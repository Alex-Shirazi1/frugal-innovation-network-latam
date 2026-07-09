import { createApp } from './app.mjs'
import { openDb } from './db.mjs'

const PORT = Number(process.env.PORT ?? 3001)

const db = openDb()
const app = createApp(db)

const server = app.listen(PORT, () => {
  console.log(`[relif-api] listening on http://localhost:${PORT}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
