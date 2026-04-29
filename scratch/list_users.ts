import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hzhxrkurljrogxtzxmmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aHhya3VybGpyb2d4dHp4bW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg1MzgsImV4cCI6MjA4OTA3NDUzOH0.lfvD6V7qCQ1eckbk2QbkSKF2rkz2uYEpmuqHqjquoPY'
const supabase = createClient(supabaseUrl, supabaseKey)

async function listUsers() {
  const { data, error } = await supabase.from('usuarios').select('*')
  if (error) {
    console.error('Error fetching users:', error)
  } else {
    console.log('Users found:', data)
  }
}

listUsers()
