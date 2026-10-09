const SUPABASE_URL = "https://hzhotlyvuxqykkttilef.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aG90bHl2dXhxeWtrdHRpbGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjY1MzUsImV4cCI6MjEwNTk0MjUzNX0.qW1C7wYI6rSBHkHkTle6A37z_uV5DSk94AmZuOJZauw";

// Create the client with a different variable name to avoid conflict
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);